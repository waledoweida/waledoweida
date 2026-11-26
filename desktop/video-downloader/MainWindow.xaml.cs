using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Media;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shell;
using System.Windows.Threading;

namespace VideoDownloader
{
    public partial class MainWindow : Window
    {
        const int MaxParallel = 3;

        readonly ObservableCollection<DownloadItem> _items = new ObservableCollection<DownloadItem>();
        readonly Settings _settings = Settings.Load();
        readonly SemaphoreSlim _slots = new SemaphoreSlim(MaxParallel);
        readonly DispatcherTimer _toastTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3.2) };

        MediaInfo _info;
        string _infoUrl;
        ImageSource _infoThumb;
        CancellationTokenSource _fetchCts;
        CancellationTokenSource _setupCts;
        string _lastClipboard = "";
        bool _loadingOptions;

        static readonly Regex UrlRx = new Regex(@"^(https?://)?([\w-]+\.)+[a-z]{2,}(/\S*)?$", RegexOptions.IgnoreCase);

        public MainWindow()
        {
            InitializeComponent();
            DownloadsList.ItemsSource = _items;
            _items.CollectionChanged += (s, e) => RefreshList();
            _toastTimer.Tick += (s, e) => { _toastTimer.Stop(); Toast.Visibility = Visibility.Collapsed; };

            AudioBox.ItemsSource = new List<Option>
            {
                new Option { Key = "mp3-320", Text = "MP3 • 320 kbps", Hint = "أعلى جودة" },
                new Option { Key = "mp3-192", Text = "MP3 • 192 kbps", Hint = "متوازن" },
                new Option { Key = "mp3-128", Text = "MP3 • 128 kbps", Hint = "حجم أصغر" },
                new Option { Key = "m4a", Text = "M4A", Hint = "الصوت الأصلي" },
            };

            _loadingOptions = true;
            FillQualities(null);
            AudioBox.SelectedItem = ((List<Option>)AudioBox.ItemsSource).FirstOrDefault(o => o.Key == _settings.AudioChoice) ?? ((List<Option>)AudioBox.ItemsSource)[0];
            CompatCheck.IsChecked = _settings.Compat;
            if (_settings.Audio) AudioMode.IsChecked = true; else VideoMode.IsChecked = true;
            _loadingOptions = false;
            ApplyMode();
            FolderText.Text = _settings.Folder;
            RefreshList();

            StateChanged += (s, e) =>
            {
                MaxBtn.Content = WindowState == WindowState.Maximized ? "" : "";
                WindowFrame.BorderThickness = WindowState == WindowState.Maximized ? new Thickness(7) : new Thickness(1);
            };
            Activated += (s, e) => { if (!_demo) CheckClipboard(); };
            DragEnter += OnDragOver;
            DragOver += OnDragOver;
            DragLeave += (s, e) => DropHint.Visibility = Visibility.Collapsed;
            Drop += OnDrop;
            Closing += OnClosing;
            Loaded += async (s, e) => await StartupAsync();
        }

        // ---------- startup / tools ----------

        bool _demo;
        public void DemoMode() { _demo = true; }

        async Task StartupAsync()
        {
            if (_demo) return;
            if (!Tools.Ready) await RunSetupAsync();
            else ToolsReady();
        }

        async Task RunSetupAsync()
        {
            SetupLayer.Visibility = Visibility.Visible;
            SetupRetry.Visibility = Visibility.Collapsed;
            SetupTitle.Text = "بنجهّز البرنامج لأول مرة";
            _setupCts = new CancellationTokenSource();
            var progress = new Progress<SetupProgress>(p =>
            {
                SetupBar.Value = p.Percent;
                SetupStep.Text = p.Label;
                SetupPct.Text = ((int)p.Percent) + "%";
                Taskbar.ProgressState = TaskbarItemProgressState.Normal;
                Taskbar.ProgressValue = p.Percent / 100;
            });
            try
            {
                await Tools.SetupAsync(progress, _setupCts.Token);
                _settings.LastToolsUpdate = DateTime.Now;
                _settings.Save();
                Taskbar.ProgressState = TaskbarItemProgressState.None;
                SetupLayer.Visibility = Visibility.Collapsed;
                ShowToast("البرنامج جاهز. الصق أي لينك وابدأ!");
                ToolsReady(skipUpdate: true);
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Log.Write("setup: " + e);
                Taskbar.ProgressState = TaskbarItemProgressState.Error;
                SetupTitle.Text = "معرفناش نحمّل الأدوات";
                SetupStep.Text = "اتأكد إنك متصل بالإنترنت ودوس «حاول تاني».";
                SetupRetry.Visibility = Visibility.Visible;
            }
        }

        async void SetupRetry_Click(object sender, RoutedEventArgs e) => await RunSetupAsync();

        async void ToolsReady(bool skipUpdate = false)
        {
            CheckClipboard();
            await ShowVersion();
            // sites change often: refresh yt-dlp quietly once every 3 days
            if (!skipUpdate && DateTime.Now - _settings.LastToolsUpdate > TimeSpan.FromDays(3) && !_items.Any(i => i.IsActive))
            {
                await UpdateTools(silent: true);
            }
        }

        async Task ShowVersion()
        {
            try
            {
                var v = await Tools.VersionAsync();
                ToolsText.Text = v.Length > 0 ? "yt-dlp " + v : "";
            }
            catch { ToolsText.Text = ""; }
        }

        async void Update_Click(object sender, RoutedEventArgs e) => await UpdateTools(silent: false);

        async Task UpdateTools(bool silent)
        {
            if (_items.Any(i => i.State == ItemState.Running || i.State == ItemState.Processing))
            {
                if (!silent) ShowToast("استنى التنزيلات تخلص الأول", error: true);
                return;
            }
            UpdateBtn.IsEnabled = false;
            UpdateText.Text = "بيحدّث…";
            bool ok;
            try { ok = await Tools.UpdateAsync(); }
            catch (Exception ex) { Log.Write("update: " + ex.Message); ok = false; }
            if (ok) { _settings.LastToolsUpdate = DateTime.Now; _settings.Save(); }
            UpdateText.Text = "تحديث الأدوات";
            UpdateBtn.IsEnabled = true;
            await ShowVersion();
            if (!silent) ShowToast(ok ? "الأدوات محدّثة لآخر نسخة" : "معرفناش نحدّث دلوقتي. جرّب بعدين", error: !ok);
        }

        // ---------- link box ----------

        static string CleanUrl(string text)
        {
            var t = (text ?? "").Trim();
            var m = Regex.Match(t, @"https?://\S+", RegexOptions.IgnoreCase);
            if (m.Success) t = m.Value;
            t = t.TrimEnd('.', ',', ')', ']', '"', '\'');
            if (!UrlRx.IsMatch(t)) return null;
            if (!t.StartsWith("http", StringComparison.OrdinalIgnoreCase)) t = "https://" + t;
            return t;
        }

        void CheckClipboard()
        {
            if (SetupLayer.Visibility == Visibility.Visible) return;
            try
            {
                if (!Clipboard.ContainsText()) return;
                var text = Clipboard.GetText();
                if (text == _lastClipboard) return;
                _lastClipboard = text;
                var url = CleanUrl(text);
                if (url == null || url == UrlBox.Text.Trim()) return;
                UrlBox.Text = url;
                UrlBox.CaretIndex = UrlBox.Text.Length;
                _ = FetchAsync();
            }
            catch { /* clipboard busy */ }
        }

        void UrlBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            DownloadBtn.IsEnabled = UrlBox.Text.Trim().Length > 0;
            if (_infoUrl != null && CleanUrl(UrlBox.Text) != _infoUrl)
            {
                ClearPreview();
            }
            ErrorBox.Visibility = Visibility.Collapsed;
            UrlFrame.BorderBrush = (Brush)FindResource(UrlBox.IsKeyboardFocused ? "Gold" : "Line");
        }

        void UrlBox_Focus(object sender, KeyboardFocusChangedEventArgs e)
        {
            UrlFrame.BorderBrush = (Brush)FindResource(UrlBox.IsKeyboardFocused ? "Gold" : "Line");
        }

        async void UrlBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key != Key.Enter) return;
            e.Handled = true;
            if (_info != null && _infoUrl == CleanUrl(UrlBox.Text)) StartDownload();
            else await FetchAsync();
        }

        async void Paste_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (!Clipboard.ContainsText()) { ShowToast("مفيش لينك منسوخ", error: true); return; }
                var text = Clipboard.GetText();
                _lastClipboard = text;
                UrlBox.Text = CleanUrl(text) ?? text.Trim();
                UrlBox.CaretIndex = UrlBox.Text.Length;
                await FetchAsync();
            }
            catch { }
        }

        async void Fetch_Click(object sender, RoutedEventArgs e) => await FetchAsync();

        async Task FetchAsync()
        {
            if (!Tools.Ready) return;
            var url = CleanUrl(UrlBox.Text);
            if (url == null)
            {
                ShowError(UrlBox.Text.Trim().Length == 0 ? "الصق لينك الفيديو الأول." : "اللينك ده مش صحيح. انسخه تاني من زرار «مشاركة».");
                return;
            }
            if (url == _infoUrl && _info != null) return;

            _fetchCts?.Cancel();
            var cts = _fetchCts = new CancellationTokenSource();
            ClearPreview();
            ErrorBox.Visibility = Visibility.Collapsed;
            Loading.Visibility = Visibility.Visible;
            FetchBtn.IsEnabled = false;
            try
            {
                var info = await YtDlp.GetInfoAsync(url, cts.Token);
                if (cts.IsCancellationRequested) return;
                ShowPreview(info, url);
            }
            catch (OperationCanceledException) { }
            catch (TimeoutException) { if (!cts.IsCancellationRequested) ShowError("الموقع اتأخر في الرد. جرّب تاني."); }
            catch (DownloadError ex) { if (!cts.IsCancellationRequested) ShowError(ex.Message); }
            catch (Exception ex)
            {
                Log.Write("info: " + ex);
                if (!cts.IsCancellationRequested) ShowError(Errors.Generic);
            }
            finally
            {
                if (cts == _fetchCts)
                {
                    Loading.Visibility = Visibility.Collapsed;
                    FetchBtn.IsEnabled = true;
                }
            }
        }

        void ShowError(string message)
        {
            ErrorText.Text = message;
            ErrorBox.Visibility = Visibility.Visible;
        }

        void ClearPreview()
        {
            _info = null;
            _infoUrl = null;
            _infoThumb = null;
            Preview.Visibility = Visibility.Collapsed;
            PlaylistCheck.IsChecked = false;
            FillQualities(null);
        }

        public void ShowPreview(MediaInfo info, string url)
        {
            _info = info;
            _infoUrl = url;
            TitleText.Text = info.Title;
            UploaderText.Text = info.Uploader;
            UploaderText.Visibility = string.IsNullOrEmpty(info.Uploader) ? Visibility.Collapsed : Visibility.Visible;
            SiteText.Text = string.IsNullOrEmpty(info.Site) ? "فيديو" : info.Site;
            DurationText.Text = FormatDuration(info.Duration);
            DurationBadge.Visibility = info.Duration > 0 ? Visibility.Visible : Visibility.Collapsed;
            _infoThumb = LoadImage(info.Thumbnail);
            PreviewThumb.ImageSource = _infoThumb;

            if (info.IsPlaylist)
            {
                PlaylistCheck.Visibility = Visibility.Visible;
                PlaylistCheck.IsChecked = true;
                PlaylistText.Text = info.Count > 0 ? "حمّل القائمة كلها (" + info.Count + " فيديو)" : "حمّل القائمة كلها";
                DurationBadge.Visibility = Visibility.Visible;
                DurationText.Text = info.Count > 0 ? info.Count + " فيديو" : "قائمة";
            }
            else if (info.HasPlaylistParam)
            {
                PlaylistCheck.Visibility = Visibility.Visible;
                PlaylistCheck.IsChecked = false;
                PlaylistText.Text = "الفيديو ده جزء من قائمة تشغيل: حمّل القائمة كلها";
            }
            else PlaylistCheck.Visibility = Visibility.Collapsed;

            FillQualities(info);
            if (info.AudioOnly) AudioMode.IsChecked = true;
            Preview.Visibility = Visibility.Visible;
        }

        static string FormatDuration(double seconds)
        {
            if (seconds <= 0) return "";
            var t = TimeSpan.FromSeconds(Math.Round(seconds));
            return t.TotalHours >= 1 ? ((int)t.TotalHours) + ":" + t.ToString(@"mm\:ss") : t.ToString(@"m\:ss");
        }

        static ImageSource LoadImage(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;
            try
            {
                var bmp = new BitmapImage();
                bmp.BeginInit();
                bmp.UriSource = new Uri(url);
                bmp.DecodePixelWidth = 320;
                bmp.CacheOption = BitmapCacheOption.OnLoad;
                bmp.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
                bmp.EndInit();
                return bmp;
            }
            catch { return null; }
        }

        // ---------- options ----------

        static string QualityName(int h)
        {
            switch (h)
            {
                case 4320: return "8K";
                case 2160: return "4K";
                case 1440: return "2K";
                case 1080: return "Full HD";
                case 720: return "HD";
                default: return "";
            }
        }

        static string SizeText(long bytes)
        {
            if (bytes <= 0) return "";
            var mb = bytes / 1048576.0;
            return mb >= 1024 ? "≈ " + (mb / 1024).ToString("0.0", CultureInfo.InvariantCulture) + " GB" : "≈ " + mb.ToString("0", CultureInfo.InvariantCulture) + " MB";
        }

        void FillQualities(MediaInfo info)
        {
            var list = new List<Option>();
            var heights = info != null && info.Heights.Count > 0
                ? info.Heights
                : new[] { 2160, 1440, 1080, 720, 480, 360, 240, 144 }.Select(h => new KeyValuePair<int, long>(h, 0)).ToList();
            var top = heights.Count > 0 ? heights[0].Key : 0;
            var bestHint = info != null && top > 0 ? top + "p" : "";
            list.Add(new Option { Height = 0, Text = "أعلى جودة متاحة", Hint = bestHint });
            foreach (var kv in heights)
            {
                var name = QualityName(kv.Key);
                var size = kv.Value > 0 ? SizeText(kv.Value + (info?.AudioSize ?? 0)) : "";
                list.Add(new Option
                {
                    Height = kv.Key,
                    Text = kv.Key + "p" + (name.Length > 0 ? "  " + name : ""),
                    Hint = size,
                });
            }
            var was = _loadingOptions;
            _loadingOptions = true;
            QualityBox.ItemsSource = list;
            // keep the user's usual choice, or the closest lower one
            var want = _settings.Height;
            QualityBox.SelectedItem = want == 0 ? list[0] : (list.Skip(1).FirstOrDefault(o => o.Height <= want) ?? list.Last());
            _loadingOptions = was;
        }

        void Mode_Changed(object sender, RoutedEventArgs e)
        {
            if (AudioOpts == null) return;
            ApplyMode();
            if (_loadingOptions) return;
            _settings.Audio = AudioMode.IsChecked == true;
            _settings.Save();
        }

        void ApplyMode()
        {
            var audio = AudioMode.IsChecked == true;
            AudioOpts.Visibility = audio ? Visibility.Visible : Visibility.Collapsed;
            VideoOpts.Visibility = audio ? Visibility.Collapsed : Visibility.Visible;
        }

        void Quality_Changed(object sender, SelectionChangedEventArgs e)
        {
            if (_loadingOptions || !(QualityBox.SelectedItem is Option o)) return;
            _settings.Height = o.Height;
            _settings.Save();
        }

        void Audio_Changed(object sender, SelectionChangedEventArgs e)
        {
            if (_loadingOptions || !(AudioBox.SelectedItem is Option o)) return;
            _settings.AudioChoice = o.Key;
            _settings.Save();
        }

        void Compat_Click(object sender, RoutedEventArgs e)
        {
            _settings.Compat = CompatCheck.IsChecked == true;
            _settings.Save();
        }

        void Folder_Click(object sender, RoutedEventArgs e)
        {
            var picked = FolderPicker.Pick(new WindowInteropHelper(this).Handle, _settings.Folder, "اختار مكان حفظ الفيديوهات");
            if (string.IsNullOrEmpty(picked)) return;
            _settings.Folder = picked;
            _settings.Save();
            FolderText.Text = picked;
        }

        // ---------- downloads ----------

        void Download_Click(object sender, RoutedEventArgs e) => StartDownload();

        void StartDownload()
        {
            if (!Tools.Ready) return;
            var url = CleanUrl(UrlBox.Text);
            if (url == null) { ShowError("اللينك ده مش صحيح. انسخه تاني من زرار «مشاركة»."); return; }
            try { Directory.CreateDirectory(_settings.Folder); }
            catch { ShowError("مش قادر أحفظ في الفولدر ده. اختار فولدر تاني."); return; }

            var req = new DownloadRequest
            {
                Url = url,
                Folder = _settings.Folder,
                Audio = AudioMode.IsChecked == true,
                Height = (QualityBox.SelectedItem as Option)?.Height ?? 0,
                Compat = CompatCheck.IsChecked == true,
                AudioChoice = (AudioBox.SelectedItem as Option)?.Key ?? "mp3-320",
                Playlist = PlaylistCheck.Visibility == Visibility.Visible && PlaylistCheck.IsChecked == true,
            };
            var hasInfo = _info != null && _infoUrl == url;
            var item = new DownloadItem
            {
                Request = req,
                Title = hasInfo ? _info.Title : url,
                Thumb = hasInfo ? _infoThumb : null,
                State = ItemState.Queued,
            };
            _items.Insert(0, item);
            _ = RunItemAsync(item);

            UrlBox.Text = "";
            ClearPreview();
            ShowToast("اتضاف للتنزيلات");
        }

        async Task RunItemAsync(DownloadItem item)
        {
            item.State = ItemState.Queued;
            item.Percent = 0;
            item.Details = "";
            item.CancelRequested = false;
            item.Finished = 0;
            UpdateTaskbar();
            await _slots.WaitAsync();
            try
            {
                if (item.CancelRequested) { item.State = ItemState.Canceled; return; }
                await DownloadAsync(item);
            }
            finally
            {
                _slots.Release();
                UpdateTaskbar();
            }
        }

        Task DownloadAsync(DownloadItem item)
        {
            var tcs = new TaskCompletionSource<bool>();
            var err = new System.Text.StringBuilder();
            item.State = ItemState.Running;
            var args = YtDlp.DownloadArgs(item.Request);
            Log.Write("download: " + item.Request.Url + " | " + item.Request.Describe());

            var p = new Process { StartInfo = YtDlp.StartInfo(args), EnableRaisingEvents = true };
            item.Process = p;
            p.OutputDataReceived += (s, e) => { if (e.Data != null) Dispatcher.BeginInvoke(new Action(() => OnLine(item, e.Data))); };
            p.ErrorDataReceived += (s, e) => { if (e.Data != null) lock (err) err.AppendLine(e.Data); };
            p.Exited += (s, e) =>
            {
                // let the last output lines arrive first
                Task.Delay(300).ContinueWith(_ => Dispatcher.BeginInvoke(new Action(() =>
                {
                    int code;
                    try { code = p.ExitCode; } catch { code = -1; }
                    string errText;
                    lock (err) errText = err.ToString();
                    OnExit(item, code, errText);
                    p.Dispose();
                    tcs.TrySetResult(true);
                })));
            };
            try
            {
                p.Start();
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                Log.Write("start: " + ex);
                item.Error = "مش قادر أشغّل أداة التنزيل. اضغط «تحديث الأدوات».";
                item.State = ItemState.Failed;
                tcs.TrySetResult(false);
            }
            return tcs.Task;
        }

        void OnLine(DownloadItem item, string line)
        {
            if (line.StartsWith("[P]", StringComparison.Ordinal))
            {
                var f = line.Substring(3).Split('|');
                if (f.Length < 5) return;
                var pct = ParsePercent(f[0]);
                if (item.State != ItemState.Running) item.State = ItemState.Running;
                item.Percent = pct;
                var size = Clean(f[3]);
                if (size.Length == 0) size = Clean(f[4]).Length > 0 ? "≈" + Clean(f[4]) : "";
                var parts = new List<string> { ((int)pct) + "%" };
                var speed = Clean(f[1]);
                if (speed.Length > 0) parts.Add(speed);
                var eta = Clean(f[2]);
                if (eta.Length > 0 && pct < 100) parts.Add(eta);
                if (size.Length > 0) parts.Add(size);
                item.Details = string.Join("  •  ", parts);
                if (f.Length >= 7 && item.Request.Playlist)
                {
                    var idx = Clean(f[5]);
                    var n = Clean(f[6]);
                    if (idx.Length > 0) item.PlaylistPos = n.Length > 0 ? idx + " من " + n : idx;
                }
                item.Touch();
                UpdateTaskbar();
            }
            else if (line.StartsWith("[M]", StringComparison.Ordinal))
            {
                if (item.State == ItemState.Running && (item.Percent >= 99 || item.Request.Audio))
                {
                    item.State = ItemState.Processing;
                    item.Details = "";
                }
            }
            else if (line.StartsWith("[T]", StringComparison.Ordinal))
            {
                var t = line.Substring(3).Trim();
                if (t.Length > 0 && t != "NA")
                {
                    if (item.Request.Playlist) item.Details = t;
                    else item.Title = t;
                }
                if (item.State == ItemState.Processing) item.State = ItemState.Running;
                item.Percent = 0;
                item.Touch();
            }
            else if (line.StartsWith("[F]", StringComparison.Ordinal))
            {
                item.FilePath = line.Substring(3).Trim();
                item.Finished++;
                if (item.Request.Playlist) item.State = ItemState.Running;
            }
        }

        static string Clean(string s)
        {
            s = (s ?? "").Trim();
            return s == "NA" || s == "Unknown" || s.StartsWith("Unknown", StringComparison.Ordinal) ? "" : s;
        }

        static double ParsePercent(string s)
        {
            s = (s ?? "").Trim().TrimEnd('%').Trim();
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? Math.Max(0, Math.Min(100, v)) : 0;
        }

        void OnExit(DownloadItem item, int code, string err)
        {
            item.Process = null;
            if (item.CancelRequested)
            {
                item.State = ItemState.Canceled;
                item.Details = "";
                return;
            }
            var ok = code == 0 || (item.Request.Playlist && item.Finished > 0);
            if (ok && (item.Finished > 0 || code == 0))
            {
                item.Percent = 100;
                item.Details = item.Request.Playlist && code != 0 ? "بعض الفيديوهات متحمّلتش" : "";
                item.State = ItemState.Done;
                SystemSounds.Asterisk.Play();
                ShowToast("خلص التنزيل: " + Shorten(item.Title, 40));
                if (!IsActive) FlashTaskbar();
            }
            else
            {
                Log.Write("failed (" + code + "): " + item.Request.Url + " | " + Errors.LastError(err));
                item.Error = Errors.Friendly(err);
                item.Details = "";
                item.State = ItemState.Failed;
            }
        }

        static string Shorten(string s, int n) => s == null ? "" : (s.Length <= n ? s : s.Substring(0, n) + "…");

        void UpdateTaskbar()
        {
            var active = _items.Where(i => i.State == ItemState.Running || i.State == ItemState.Processing).ToList();
            if (active.Count == 0 && !_items.Any(i => i.State == ItemState.Queued))
            {
                Taskbar.ProgressState = TaskbarItemProgressState.None;
                return;
            }
            if (active.Count == 0 || active.All(i => i.Indeterminate))
            {
                Taskbar.ProgressState = TaskbarItemProgressState.Indeterminate;
                return;
            }
            Taskbar.ProgressState = TaskbarItemProgressState.Normal;
            Taskbar.ProgressValue = active.Average(i => i.Percent) / 100.0;
        }

        void FlashTaskbar()
        {
            try
            {
                var info = new FLASHWINFO
                {
                    cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(FLASHWINFO)),
                    hwnd = new WindowInteropHelper(this).Handle,
                    dwFlags = 2 | 12, // FLASHW_TRAY | FLASHW_TIMERNOFG
                    uCount = 3,
                };
                FlashWindowEx(ref info);
            }
            catch { }
        }

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        struct FLASHWINFO { public uint cbSize; public IntPtr hwnd; public uint dwFlags; public uint uCount; public uint dwTimeout; }

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

        void RefreshList()
        {
            CountText.Text = _items.Count.ToString(CultureInfo.InvariantCulture);
            EmptyState.Visibility = _items.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            ClearBtn.IsEnabled = _items.Any(i => i.CanRemove);
        }

        static DownloadItem ItemOf(object sender) => (sender as FrameworkElement)?.DataContext as DownloadItem;

        void ItemCancel_Click(object sender, RoutedEventArgs e)
        {
            var item = ItemOf(sender);
            if (item == null) return;
            item.CancelRequested = true;
            if (item.Process != null) YtDlp.Kill(item.Process);
            else if (item.State == ItemState.Queued) item.State = ItemState.Canceled;
            RefreshList();
        }

        void ItemRetry_Click(object sender, RoutedEventArgs e)
        {
            var item = ItemOf(sender);
            if (item == null) return;
            _ = RunItemAsync(item);
            RefreshList();
        }

        void ItemRemove_Click(object sender, RoutedEventArgs e)
        {
            var item = ItemOf(sender);
            if (item != null && item.CanRemove) _items.Remove(item);
        }

        void ItemOpen_Click(object sender, RoutedEventArgs e)
        {
            var item = ItemOf(sender);
            if (item == null) return;
            if (!string.IsNullOrEmpty(item.FilePath) && File.Exists(item.FilePath) && !item.Request.Playlist) OpenShell(item.FilePath);
            else ItemShow_Click(sender, e);
        }

        void ItemShow_Click(object sender, RoutedEventArgs e)
        {
            var item = ItemOf(sender);
            if (item == null) return;
            if (!string.IsNullOrEmpty(item.FilePath) && File.Exists(item.FilePath))
                OpenShell("explorer.exe", "/select,\"" + item.FilePath + "\"");
            else OpenShell(item.Request.Folder);
        }

        void OpenFolder_Click(object sender, RoutedEventArgs e)
        {
            try { Directory.CreateDirectory(_settings.Folder); } catch { }
            OpenShell(_settings.Folder);
        }

        void Clear_Click(object sender, RoutedEventArgs e)
        {
            foreach (var i in _items.Where(x => x.CanRemove).ToList()) _items.Remove(i);
        }

        static void OpenShell(string target, string args = null)
        {
            try
            {
                if (args == null) Process.Start(new ProcessStartInfo(target) { UseShellExecute = true });
                else Process.Start(new ProcessStartInfo(target, args) { UseShellExecute = true });
            }
            catch (Exception e) { Log.Write("shell: " + e.Message); }
        }

        void Site_Click(object sender, RoutedEventArgs e) => OpenShell("https://waledoweida.com/");

        // ---------- toast ----------

        void ShowToast(string text, bool error = false)
        {
            ToastText.Text = text;
            ToastIcon.Text = error ? "" : "";
            ToastIcon.Foreground = (Brush)FindResource(error ? "Red" : "Green");
            Toast.Visibility = Visibility.Visible;
            _toastTimer.Stop();
            _toastTimer.Start();
        }

        // ---------- drag & drop ----------

        void OnDragOver(object sender, DragEventArgs e)
        {
            var ok = e.Data.GetDataPresent(DataFormats.UnicodeText) || e.Data.GetDataPresent(DataFormats.Text);
            e.Effects = ok ? DragDropEffects.Copy : DragDropEffects.None;
            DropHint.Visibility = ok ? Visibility.Visible : Visibility.Collapsed;
            e.Handled = true;
        }

        async void OnDrop(object sender, DragEventArgs e)
        {
            DropHint.Visibility = Visibility.Collapsed;
            var text = (e.Data.GetData(DataFormats.UnicodeText) ?? e.Data.GetData(DataFormats.Text)) as string;
            var url = CleanUrl(text);
            if (url == null) { ShowToast("ده مش لينك فيديو", error: true); return; }
            UrlBox.Text = url;
            await FetchAsync();
        }

        // ---------- window ----------

        void Min_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
        void Max_Click(object sender, RoutedEventArgs e) => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        void Close_Click(object sender, RoutedEventArgs e) => Close();

        void OnClosing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            var running = _items.Where(i => i.IsActive).ToList();
            if (running.Count > 0)
            {
                var r = MessageBox.Show(this, "فيه " + running.Count + " تنزيل لسه شغال. لو قفلت البرنامج هيتلغوا.\n\nتقفل برضه؟",
                    "تنزيل الفيديوهات", MessageBoxButton.YesNo, MessageBoxImage.Question, MessageBoxResult.No,
                    MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
                if (r != MessageBoxResult.Yes) { e.Cancel = true; return; }
                foreach (var i in running)
                {
                    i.CancelRequested = true;
                    if (i.Process != null) YtDlp.Kill(i.Process);
                }
            }
            _setupCts?.Cancel();
            _settings.Save();
        }

        // ---------- screenshots for the build (--shot) ----------

        public void LoadDemo(ImageSource thumb)
        {
            UrlBox.Text = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
            var info = new MediaInfo
            {
                Title = "رحلة إلى أسوان | أجمل أماكن النيل في 4K",
                Uploader = "قناة السفر",
                Site = "YouTube",
                Duration = 754,
                Heights = new List<KeyValuePair<int, long>>
                {
                    new KeyValuePair<int, long>(2160, 1_200_000_000), new KeyValuePair<int, long>(1440, 640_000_000),
                    new KeyValuePair<int, long>(1080, 310_000_000), new KeyValuePair<int, long>(720, 160_000_000),
                    new KeyValuePair<int, long>(480, 80_000_000), new KeyValuePair<int, long>(360, 50_000_000),
                },
                AudioSize = 12_000_000,
                HasPlaylistParam = true,
            };
            ShowPreview(info, CleanUrl(UrlBox.Text));
            _infoThumb = thumb;
            PreviewThumb.ImageSource = thumb;

            var r1 = new DownloadRequest { Url = "x", Folder = _settings.Folder, Height = 1080, Compat = true };
            var r2 = new DownloadRequest { Url = "x", Folder = _settings.Folder, Audio = true, AudioChoice = "mp3-320" };
            var r3 = new DownloadRequest { Url = "x", Folder = _settings.Folder, Height = 720, Compat = true, Playlist = true };
            var r4 = new DownloadRequest { Url = "x", Folder = _settings.Folder, Height = 0 };
            _items.Add(new DownloadItem { Request = r1, Title = "رحلة إلى أسوان | أجمل أماكن النيل", Thumb = thumb, State = ItemState.Running, Percent = 62, Details = "62%  •  8.4MiB/s  •  00:14  •  310.2MiB" });
            _items.Add(new DownloadItem { Request = r3, Title = "كورس التصميم كامل", State = ItemState.Running, Percent = 35, Details = "35%  •  5.1MiB/s  •  00:41", PlaylistPos = "3 من 12" });
            _items.Add(new DownloadItem { Request = r2, Title = "أغنية الصباح - نسخة أصلية", Thumb = thumb, State = ItemState.Done, Percent = 100 });
            _items.Add(new DownloadItem { Request = r4, Title = "https://www.instagram.com/p/xyz", State = ItemState.Failed, Error = "الفيديو ده خاص ومينفعش يتحمّل." });
            ToolsText.Text = "yt-dlp 2026.11.20";
        }

        public void ShowSetupDemo()
        {
            SetupLayer.Visibility = Visibility.Visible;
            SetupBar.Value = 47;
            SetupPct.Text = "47%";
            SetupStep.Text = "أداة دمج الصوت والصورة (ffmpeg)  •  38.5 من 120 ميجا";
        }
    }
}
