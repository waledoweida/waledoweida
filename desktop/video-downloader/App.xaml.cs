using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace VideoDownloader
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            Tools.EnableTls();
            DispatcherUnhandledException += (s, ex) =>
            {
                Log.Write("crash: " + ex.Exception);
                ex.Handled = true;
            };
            AppDomain.CurrentDomain.UnhandledException += (s, ex) => Log.Write("fatal: " + ex.ExceptionObject);
            TaskScheduler.UnobservedTaskException += (s, ex) => { Log.Write("task: " + ex.Exception); ex.SetObserved(); };

            var args = e.Args;
            if (args.Length >= 2 && args[0] == "--shot") { _ = Shots(args[1]); return; }
            if (args.Length >= 3 && args[0] == "--engine-test") { _ = EngineTest(args[1], args[2]); return; }

            var w = new MainWindow();
            MainWindow = w;
            w.Show();
        }

        // ---------- build checks (used by the GitHub workflow) ----------

        static async Task WaitRender(int ms)
        {
            await Task.Delay(ms);
            await Dispatcher.CurrentDispatcher.InvokeAsync(() => { }, DispatcherPriority.Background);
        }

        static void Save(FrameworkElement el, string path)
        {
            var w = (int)Math.Ceiling(el.ActualWidth);
            var h = (int)Math.Ceiling(el.ActualHeight);
            var rtb = new RenderTargetBitmap(w, h, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(el);
            var enc = new PngBitmapEncoder();
            enc.Frames.Add(BitmapFrame.Create(rtb));
            using (var f = File.Create(path)) enc.Save(f);
        }

        static ImageSource DemoThumb()
        {
            var g = new DrawingGroup();
            var sky = new LinearGradientBrush(Color.FromRgb(0x2B, 0x5D, 0x8C), Color.FromRgb(0xE8, 0xA8, 0x5C), 90);
            g.Children.Add(new GeometryDrawing(sky, null, new RectangleGeometry(new Rect(0, 0, 320, 180))));
            g.Children.Add(new GeometryDrawing(new SolidColorBrush(Color.FromRgb(0xF6, 0xD3, 0x7A)), null, new EllipseGeometry(new Point(230, 92), 26, 26)));
            g.Children.Add(new GeometryDrawing(new SolidColorBrush(Color.FromRgb(0x1C, 0x3B, 0x52)), null,
                Geometry.Parse("M0,130 C60,110 120,140 180,120 C240,100 280,125 320,115 L320,180 L0,180 Z")));
            return new DrawingImage(g);
        }

        async Task Shots(string dir)
        {
            int code = 0;
            void Mark(string m) { try { File.AppendAllText(Path.Combine(dir, "shot.log"), DateTime.Now.ToString("HH:mm:ss.fff ") + m + Environment.NewLine); } catch { } }
            try
            {
                Directory.CreateDirectory(dir);
                Mark("start");
                var w = new MainWindow();
                w.DemoMode();
                MainWindow = w;
                Mark("window created");
                w.Show();
                Mark("shown");
                await WaitRender(800);
                Mark("rendered");
                Save((FrameworkElement)w.Content, Path.Combine(dir, "1-empty.png"));
                w.LoadDemo(DemoThumb());
                await WaitRender(1200);
                Save((FrameworkElement)w.Content, Path.Combine(dir, "2-main.png"));
                w.AudioMode.IsChecked = true;
                await WaitRender(400);
                Save((FrameworkElement)w.Content, Path.Combine(dir, "3-audio.png"));
                w.ShowSetupDemo();
                await WaitRender(500);
                Save((FrameworkElement)w.Content, Path.Combine(dir, "4-setup.png"));
                Mark("all saved");
            }
            catch (Exception ex)
            {
                File.WriteAllText(Path.Combine(dir, "shot-error.txt"), ex.ToString());
                code = 1;
            }
            Shutdown(code);
        }

        async Task EngineTest(string url, string dir)
        {
            var log = new StringBuilder();
            void L(string s) { log.AppendLine(DateTime.Now.ToString("HH:mm:ss ") + s); try { File.WriteAllText(Path.Combine(dir, "engine.log"), log.ToString()); } catch { } }
            int code = 1;
            try
            {
                Directory.CreateDirectory(dir);
                L("setup…");
                await Tools.SetupAsync(new Progress<SetupProgress>(p => { }), CancellationToken.None);
                L("tools ready: " + Tools.Ready + " | yt-dlp " + await Tools.VersionAsync());

                var info = await YtDlp.GetInfoAsync(url, CancellationToken.None);
                L("info: " + info.Title + " | " + info.Site + " | " + info.Duration + "s | heights " + string.Join(",", info.Heights.Select(h => h.Key + ":" + h.Value)) + " | thumb " + info.Thumbnail);

                var ok = true;
                foreach (var req in new[]
                {
                    new DownloadRequest { Url = url, Folder = dir, Height = 360, Compat = true },
                    new DownloadRequest { Url = url, Folder = dir, Audio = true, AudioChoice = "mp3-128" },
                })
                {
                    var args = YtDlp.DownloadArgs(req);
                    L("run: " + string.Join(" ", args.Select(YtDlp.Quote)));
                    var p = Process.Start(YtDlp.StartInfo(args));
                    var outText = await p.StandardOutput.ReadToEndAsync();
                    var errText = await p.StandardError.ReadToEndAsync();
                    p.WaitForExit();
                    var lines = outText.Split('\n');
                    L("exit " + p.ExitCode + " | lines " + lines.Length + " | progress lines " + lines.Count(x => x.StartsWith("[P]")));
                    foreach (var x in lines.Where(x => !x.StartsWith("[P]")).Take(20)) L("  out: " + x.TrimEnd());
                    foreach (var x in lines.Where(x => x.StartsWith("[P]")).Take(3)) L("  prog: " + x.TrimEnd());
                    if (errText.Trim().Length > 0) L("  err: " + errText.Trim());
                    var file = lines.Select(x => x.Trim()).FirstOrDefault(x => x.StartsWith("[F]"));
                    var exists = file != null && File.Exists(file.Substring(3));
                    L("  file: " + file + " exists=" + exists + (exists ? " size=" + new FileInfo(file.Substring(3)).Length : ""));
                    if (p.ExitCode != 0 || !exists) { ok = false; L("  friendly: " + Errors.Friendly(errText)); }
                }
                code = ok ? 0 : 2;
            }
            catch (Exception ex) { L("exception: " + ex); }
            L("done code=" + code);
            Shutdown(code);
        }
    }
}
