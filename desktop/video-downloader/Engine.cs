using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace VideoDownloader
{
    /// <summary>Where the app keeps its tools, settings and log (per user, no admin rights needed).</summary>
    public static class Paths
    {
        public static readonly string Root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WaledVideoDownloader");
        public static readonly string Tools = Path.Combine(Root, "tools");
        public static string YtDlp => Path.Combine(Tools, "yt-dlp.exe");
        public static string Ffmpeg => Path.Combine(Tools, "ffmpeg.exe");
        public static string Ffprobe => Path.Combine(Tools, "ffprobe.exe");
        public static string Deno => Path.Combine(Tools, "deno.exe");
        public static string SettingsFile => Path.Combine(Root, "settings.txt");
        public static string LogFile => Path.Combine(Root, "log.txt");

        public static string DefaultDownloads
        {
            get
            {
                var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                return Path.Combine(home, "Downloads", "Video Downloader");
            }
        }
    }

    public static class Log
    {
        static readonly object Gate = new object();

        public static void Write(string line)
        {
            try
            {
                lock (Gate)
                {
                    Directory.CreateDirectory(Paths.Root);
                    var fi = new FileInfo(Paths.LogFile);
                    if (fi.Exists && fi.Length > 2_000_000) fi.Delete();
                    File.AppendAllText(Paths.LogFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss ") + line + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch { /* logging must never break the app */ }
        }
    }

    /// <summary>Simple key=value settings file.</summary>
    public class Settings
    {
        public string Folder = Paths.DefaultDownloads;
        public bool Audio;
        public int Height;               // 0 = best available
        public bool Compat = true;       // MP4 / H.264 that plays everywhere
        public string AudioChoice = "mp3-320";
        public DateTime LastToolsUpdate = DateTime.MinValue;

        public static Settings Load()
        {
            var s = new Settings();
            try
            {
                if (!File.Exists(Paths.SettingsFile)) return s;
                foreach (var raw in File.ReadAllLines(Paths.SettingsFile, Encoding.UTF8))
                {
                    var i = raw.IndexOf('=');
                    if (i <= 0) continue;
                    var k = raw.Substring(0, i).Trim();
                    var v = raw.Substring(i + 1).Trim();
                    switch (k)
                    {
                        case "folder": if (v.Length > 0) s.Folder = v; break;
                        case "audio": s.Audio = v == "1"; break;
                        case "height": int.TryParse(v, out s.Height); break;
                        case "compat": s.Compat = v != "0"; break;
                        case "audioChoice": if (v.Length > 0) s.AudioChoice = v; break;
                        case "toolsUpdated":
                            if (long.TryParse(v, out var ticks)) s.LastToolsUpdate = new DateTime(ticks);
                            break;
                    }
                }
            }
            catch (Exception e) { Log.Write("settings load: " + e.Message); }
            return s;
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Paths.Root);
                File.WriteAllLines(Paths.SettingsFile, new[]
                {
                    "folder=" + Folder,
                    "audio=" + (Audio ? "1" : "0"),
                    "height=" + Height,
                    "compat=" + (Compat ? "1" : "0"),
                    "audioChoice=" + AudioChoice,
                    "toolsUpdated=" + LastToolsUpdate.Ticks,
                }, Encoding.UTF8);
            }
            catch (Exception e) { Log.Write("settings save: " + e.Message); }
        }
    }

    public struct SetupProgress
    {
        public string Label;
        public double Percent;
        public SetupProgress(string label, double percent) { Label = label; Percent = percent; }
    }

    /// <summary>Downloads and updates the free tools that do the actual work: yt-dlp, ffmpeg and deno.</summary>
    public static class Tools
    {
        const string YtDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        static readonly string[] FfmpegUrls =
        {
            "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
            "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        };
        const string DenoUrl = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";

        public static bool Ready =>
            File.Exists(Paths.YtDlp) && File.Exists(Paths.Ffmpeg) && File.Exists(Paths.Ffprobe) && File.Exists(Paths.Deno);

        public static void EnableTls()
        {
            try { ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | (SecurityProtocolType)12288; }
            catch { ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12; }
        }

        /// <summary>Gets whatever is missing. Progress: overall 0..100 with a label for the current step.</summary>
        public static async Task SetupAsync(IProgress<SetupProgress> progress, CancellationToken ct)
        {
            EnableTls();
            Directory.CreateDirectory(Paths.Tools);

            // weights roughly follow the download sizes
            double done = 0;
            if (!File.Exists(Paths.YtDlp))
            {
                await Fetch(YtDlpUrl, Paths.YtDlp, "أداة التنزيل (yt-dlp)", done, 15, progress, ct);
            }
            done = 15;
            if (!File.Exists(Paths.Deno))
            {
                var zip = Path.Combine(Paths.Tools, "deno.zip");
                await Fetch(DenoUrl, zip, "محرك يوتيوب (deno)", done, 25, progress, ct);
                Unzip(zip, new Dictionary<string, string> { { "deno.exe", Paths.Deno } });
            }
            done = 40;
            if (!File.Exists(Paths.Ffmpeg) || !File.Exists(Paths.Ffprobe))
            {
                var zip = Path.Combine(Paths.Tools, "ffmpeg.zip");
                Exception last = null;
                foreach (var url in FfmpegUrls)
                {
                    try
                    {
                        await Fetch(url, zip, "أداة دمج الصوت والصورة (ffmpeg)", done, 60, progress, ct);
                        Unzip(zip, new Dictionary<string, string> { { "ffmpeg.exe", Paths.Ffmpeg }, { "ffprobe.exe", Paths.Ffprobe } });
                        last = null;
                        break;
                    }
                    catch (OperationCanceledException) { throw; }
                    catch (Exception e) { last = e; Log.Write("ffmpeg from " + url + ": " + e.Message); }
                }
                if (last != null) throw last;
            }
            progress?.Report(new SetupProgress("جاهز", 100));
        }

        static async Task Fetch(string url, string dest, string label, double start, double weight,
            IProgress<SetupProgress> progress, CancellationToken ct)
        {
            var part = dest + ".part";
            using (var wc = new WebClient())
            {
                wc.Headers[HttpRequestHeader.UserAgent] = "WaledVideoDownloader/2.0";
                wc.DownloadProgressChanged += (s, e) =>
                {
                    double frac = e.TotalBytesToReceive > 0 ? (double)e.BytesReceived / e.TotalBytesToReceive : 0;
                    var mb = e.BytesReceived / 1048576.0;
                    var total = e.TotalBytesToReceive > 0 ? " من " + (e.TotalBytesToReceive / 1048576.0).ToString("0") + " ميجا" : "";
                    progress?.Report(new SetupProgress(label + "  •  " + mb.ToString("0.0") + total, start + weight * frac));
                };
                progress?.Report(new SetupProgress(label, start));
                using (ct.Register(wc.CancelAsync))
                {
                    try { await wc.DownloadFileTaskAsync(new Uri(url), part); }
                    catch (WebException) when (ct.IsCancellationRequested) { throw new OperationCanceledException(ct); }
                }
            }
            if (File.Exists(dest)) File.Delete(dest);
            File.Move(part, dest);
        }

        static void Unzip(string zipPath, Dictionary<string, string> wanted)
        {
            var found = new HashSet<string>();
            using (var zip = ZipFile.OpenRead(zipPath))
            {
                foreach (var entry in zip.Entries)
                {
                    var name = entry.Name.ToLowerInvariant();
                    if (wanted.TryGetValue(name, out var dest) && !found.Contains(name))
                    {
                        entry.ExtractToFile(dest, true);
                        found.Add(name);
                    }
                }
            }
            try { File.Delete(zipPath); } catch { }
            var missing = wanted.Keys.Where(k => !found.Contains(k)).ToList();
            if (missing.Count > 0) throw new IOException("missing in archive: " + string.Join(", ", missing));
        }

        public static async Task<string> VersionAsync()
        {
            if (!File.Exists(Paths.YtDlp)) return "";
            var r = await YtDlp.RunAsync(new[] { "--version" }, CancellationToken.None, 20000);
            return r.ExitCode == 0 ? r.Out.Trim() : "";
        }

        /// <summary>Updates yt-dlp in place (sites change often; this keeps downloads working).</summary>
        public static async Task<bool> UpdateAsync()
        {
            EnableTls();
            if (!File.Exists(Paths.YtDlp)) return false;
            var r = await YtDlp.RunAsync(new[] { "-U" }, CancellationToken.None, 180000);
            Log.Write("yt-dlp -U: " + r.ExitCode + " " + r.Out.Trim() + " " + r.Err.Trim());
            return r.ExitCode == 0;
        }
    }

    public class RunResult
    {
        public int ExitCode;
        public string Out = "";
        public string Err = "";
    }

    public class MediaInfo
    {
        public string Title = "";
        public string Uploader = "";
        public string Site = "";
        public string Url = "";
        public string Thumbnail = "";
        public double Duration;
        public bool IsPlaylist;
        public int Count;
        public bool HasPlaylistParam;
        public bool AudioOnly;
        /// <summary>Available video heights, highest first, with an approximate size in bytes (0 = unknown).</summary>
        public List<KeyValuePair<int, long>> Heights = new List<KeyValuePair<int, long>>();
        public long AudioSize;
    }

    public class DownloadRequest
    {
        public string Url;
        public string Folder;
        public bool Audio;
        public int Height;
        public bool Compat;
        public string AudioChoice;     // mp3-320, mp3-192, mp3-128, m4a
        public bool Playlist;

        public string Describe()
        {
            if (Audio)
            {
                switch (AudioChoice)
                {
                    case "m4a": return "صوت M4A";
                    case "mp3-192": return "صوت MP3 • 192 kbps";
                    case "mp3-128": return "صوت MP3 • 128 kbps";
                    default: return "صوت MP3 • 320 kbps";
                }
            }
            var q = Height > 0 ? Height + "p" : "أعلى جودة";
            return "فيديو " + q + (Compat ? " • MP4" : "");
        }
    }

    /// <summary>Runs yt-dlp.</summary>
    public static class YtDlp
    {
        /// <summary>Windows command-line quoting (CommandLineToArgvW rules).</summary>
        public static string Quote(string arg)
        {
            if (arg.Length > 0 && arg.IndexOfAny(new[] { ' ', '\t', '"', '&', '|', '<', '>', '^' }) < 0) return arg;
            var sb = new StringBuilder("\"");
            int slashes = 0;
            foreach (var c in arg)
            {
                if (c == '\\') { slashes++; continue; }
                if (c == '"') { sb.Append('\\', slashes * 2 + 1); sb.Append('"'); }
                else { sb.Append('\\', slashes); sb.Append(c); }
                slashes = 0;
            }
            sb.Append('\\', slashes * 2);
            sb.Append('"');
            return sb.ToString();
        }

        public static ProcessStartInfo StartInfo(IEnumerable<string> args)
        {
            var psi = new ProcessStartInfo(Paths.YtDlp, string.Join(" ", args.Select(Quote)))
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = new UTF8Encoding(false),
                StandardErrorEncoding = new UTF8Encoding(false),
                WorkingDirectory = Paths.Tools,
            };
            psi.EnvironmentVariables["PYTHONUTF8"] = "1";
            psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
            psi.EnvironmentVariables["PATH"] = Paths.Tools + ";" + (psi.EnvironmentVariables["PATH"] ?? "");
            return psi;
        }

        static IEnumerable<string> Common()
        {
            return new[]
            {
                "--ignore-config", "--no-colors",
                "--ffmpeg-location", Paths.Tools,
                "--js-runtimes", "deno:" + Paths.Deno,
            };
        }

        public static async Task<RunResult> RunAsync(IEnumerable<string> args, CancellationToken ct, int timeoutMs)
        {
            var r = new RunResult();
            using (var p = new Process { StartInfo = StartInfo(args) })
            {
                p.Start();
                var outTask = p.StandardOutput.ReadToEndAsync();
                var errTask = p.StandardError.ReadToEndAsync();
                var exited = Task.Run(() => p.WaitForExit(timeoutMs));
                using (ct.Register(() => Kill(p)))
                {
                    var ok = await exited;
                    if (!ok) { Kill(p); throw new TimeoutException(); }
                }
                ct.ThrowIfCancellationRequested();
                r.Out = await outTask;
                r.Err = await errTask;
                r.ExitCode = p.ExitCode;
            }
            return r;
        }

        public static void Kill(Process p)
        {
            try
            {
                if (p.HasExited) return;
                // yt-dlp starts ffmpeg: end the whole tree
                using (var k = Process.Start(new ProcessStartInfo("taskkill", "/PID " + p.Id + " /T /F")
                { CreateNoWindow = true, UseShellExecute = false }))
                {
                    k?.WaitForExit(5000);
                }
                if (!p.HasExited) p.Kill();
            }
            catch { }
        }

        public static async Task<MediaInfo> GetInfoAsync(string url, CancellationToken ct)
        {
            var args = Common().Concat(new[] { "-J", "--flat-playlist", "--no-playlist", "--no-warnings", url });
            var r = await RunAsync(args, ct, 90000);
            if (r.ExitCode != 0 || r.Out.TrimStart().Length == 0 || r.Out.TrimStart()[0] != '{')
                throw new DownloadError(Errors.Friendly(r.Err));

            var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 256 };
            var root = ser.DeserializeObject(r.Out) as Dictionary<string, object>;
            if (root == null) throw new DownloadError(Errors.Generic);
            return ParseInfo(root, url);
        }

        public static MediaInfo ParseInfo(Dictionary<string, object> root, string url)
        {
            var m = new MediaInfo
            {
                Url = url,
                Title = Str(root, "title") ?? Str(root, "id") ?? "",
                Uploader = Str(root, "uploader") ?? Str(root, "channel") ?? Str(root, "playlist_uploader") ?? "",
                Site = Str(root, "extractor_key") ?? Str(root, "extractor") ?? "",
                Duration = Num(root, "duration"),
                IsPlaylist = Str(root, "_type") == "playlist",
                HasPlaylistParam = url.IndexOf("list=", StringComparison.OrdinalIgnoreCase) >= 0,
            };
            if (m.Site.StartsWith("Youtube", StringComparison.OrdinalIgnoreCase)) m.Site = "YouTube";

            if (m.IsPlaylist)
            {
                var entries = root.TryGetValue("entries", out var e) ? e as object[] : null;
                m.Count = (int)Num(root, "playlist_count");
                if (m.Count == 0 && entries != null) m.Count = entries.Length;
                if (entries != null && entries.Length > 0 && entries[0] is Dictionary<string, object> first)
                    m.Thumbnail = PickThumb(first);
            }
            if (string.IsNullOrEmpty(m.Thumbnail)) m.Thumbnail = PickThumb(root);

            var formats = root.TryGetValue("formats", out var f) ? f as object[] : null;
            if (formats != null)
            {
                var best = new Dictionary<int, long>();
                foreach (var o in formats.OfType<Dictionary<string, object>>())
                {
                    var vcodec = Str(o, "vcodec") ?? "";
                    var acodec = Str(o, "acodec") ?? "";
                    var size = (long)Math.Max(Num(o, "filesize"), Num(o, "filesize_approx"));
                    var h = (int)Num(o, "height");
                    if (vcodec == "none" && acodec != "none" && acodec.Length > 0)
                    {
                        m.AudioSize = Math.Max(m.AudioSize, size);
                        continue;
                    }
                    if (h <= 0 || vcodec == "none") continue;
                    var key = Normalize(h, (int)Num(o, "width"));
                    if (!best.ContainsKey(key) || size > best[key]) best[key] = size;
                }
                m.Heights = best.OrderByDescending(kv => kv.Key).ToList();
                m.AudioOnly = m.Heights.Count == 0 && formats.Length > 0;
            }
            return m;
        }

        /// <summary>Maps odd heights (e.g. 1012 for a wide 1920 video) to the usual quality steps.</summary>
        static int Normalize(int h, int w)
        {
            var side = w > h ? h : w;      // portrait videos: use the short side
            if (w > 0 && w > h && w >= 1900 && h < 1080) side = 1080;
            if (w > 0 && w > h && w >= 3800) side = 2160;
            if (w > 0 && w > h && w >= 2500 && side < 1440) side = 1440;
            if (w > 0 && w > h && w >= 1270 && side < 720) side = 720;
            if (side <= 0) side = h;
            int[] steps = { 4320, 2160, 1440, 1080, 720, 480, 360, 240, 144 };
            foreach (var s in steps) if (side >= s * 0.9) return s;
            return 144;
        }

        static string PickThumb(Dictionary<string, object> d)
        {
            var id = Str(d, "id");
            var ex = (Str(d, "extractor_key") ?? Str(d, "ie_key") ?? "").ToLowerInvariant();
            if (ex.StartsWith("youtube") && !string.IsNullOrEmpty(id) && id.Length == 11)
                return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
            string pick = null;
            if (d.TryGetValue("thumbnails", out var t) && t is object[] list)
            {
                foreach (var o in list.OfType<Dictionary<string, object>>())
                {
                    var u = Str(o, "url");
                    if (string.IsNullOrEmpty(u)) continue;
                    if (u.IndexOf(".webp", StringComparison.OrdinalIgnoreCase) >= 0 && pick != null) continue;
                    pick = u;
                }
            }
            var thumb = Str(d, "thumbnail");
            if (!string.IsNullOrEmpty(thumb) && (pick == null || thumb.IndexOf(".webp", StringComparison.OrdinalIgnoreCase) < 0)) pick = thumb;
            return pick ?? "";
        }

        public static string Str(Dictionary<string, object> d, string k)
        {
            return d.TryGetValue(k, out var v) && v != null ? Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) : null;
        }

        public static double Num(Dictionary<string, object> d, string k)
        {
            if (!d.TryGetValue(k, out var v) || v == null) return 0;
            try { return Convert.ToDouble(v, System.Globalization.CultureInfo.InvariantCulture); } catch { return 0; }
        }

        public static List<string> DownloadArgs(DownloadRequest r)
        {
            var a = new List<string>(Common())
            {
                "--newline", "--quiet", "--progress", "--no-simulate",
                "--progress-template", "download:[P]%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str)s|%(progress._total_bytes_estimate_str)s|%(info.playlist_index)s|%(info.n_entries)s",
                "--progress-template", "postprocess:[M]%(progress.postprocessor)s",
                "--print", "before_dl:[T]%(title)s",
                "--print", "after_move:[F]%(filepath)s",
                "--windows-filenames", "--no-mtime", "--embed-metadata",
                "--retries", "5", "--fragment-retries", "10", "--concurrent-fragments", "8", "--buffer-size", "1M", "--socket-timeout", "20",
                "-P", r.Folder,
            };

            if (r.Audio)
            {
                a.AddRange(new[] { "-f", "ba/b", "-x", "--embed-thumbnail" });
                switch (r.AudioChoice)
                {
                    case "m4a": a.AddRange(new[] { "--audio-format", "m4a", "--audio-quality", "0" }); break;
                    case "mp3-192": a.AddRange(new[] { "--audio-format", "mp3", "--audio-quality", "192K" }); break;
                    case "mp3-128": a.AddRange(new[] { "--audio-format", "mp3", "--audio-quality", "128K" }); break;
                    default: a.AddRange(new[] { "--audio-format", "mp3", "--audio-quality", "320K" }); break;
                }
            }
            else
            {
                var sort = new List<string>();
                if (r.Height > 0) sort.Add("res:" + r.Height);
                if (r.Compat) { sort.Add("vcodec:h264"); sort.Add("acodec:aac"); }
                a.AddRange(new[] { "-f", "bv*+ba/b" });
                if (sort.Count > 0) a.AddRange(new[] { "-S", string.Join(",", sort) });
                a.AddRange(new[] { "--merge-output-format", r.Compat ? "mp4" : "mp4/mkv", "--embed-chapters" });
            }

            var name = r.Audio ? "%(title).150B.%(ext)s" : "%(title).140B (%(height)sp).%(ext)s";
            if (r.Playlist)
            {
                a.AddRange(new[] { "--yes-playlist", "--ignore-errors", "-o", "%(playlist_title,playlist_id).80B/%(playlist_index)03d - " + name });
            }
            else
            {
                a.AddRange(new[] { "--no-playlist", "-o", name });
            }
            a.Add("--");
            a.Add(r.Url);
            return a;
        }
    }

    public class DownloadError : Exception
    {
        public DownloadError(string message) : base(message) { }
    }

    /// <summary>Turns yt-dlp's English errors into short Arabic messages.</summary>
    public static class Errors
    {
        public const string Generic = "حصلت مشكلة. اتأكد من اللينك والإنترنت وجرّب تاني.";

        public static string Friendly(string err)
        {
            var e = (err ?? "").ToLowerInvariant();
            if (e.Contains("unsupported url")) return "الموقع ده مش مدعوم، أو اللينك مش لينك فيديو.";
            if (e.Contains("is not a valid url") || e.Contains("invalid url")) return "اللينك ده مش صحيح. انسخه تاني من زرار «مشاركة».";
            if (e.Contains("private video") || e.Contains("this video is private")) return "الفيديو ده خاص ومينفعش يتحمّل.";
            if (e.Contains("sign in to confirm your age") || e.Contains("age-restricted") || e.Contains("inappropriate for some users")) return "الفيديو ده محدد بسن ومحتاج تسجيل دخول.";
            if (e.Contains("sign in to confirm you") || e.Contains("not a bot")) return "يوتيوب طالب تأكيد مؤقت. استنى شوية وجرّب تاني، أو اضغط «تحديث الأدوات».";
            if (e.Contains("members-only") || e.Contains("join this channel")) return "الفيديو ده للأعضاء المشتركين في القناة بس.";
            if (e.Contains("is not available in your country") || e.Contains("geo")) return "الفيديو ده مش متاح في بلدك.";
            if (e.Contains("live event will begin") || e.Contains("premieres in")) return "الفيديو لسه منزلش. استنى لحد ما يبدأ.";
            if (e.Contains("video unavailable") || e.Contains("has been removed") || e.Contains("does not exist") || e.Contains("404")) return "الفيديو ده مش موجود أو اتمسح.";
            if (e.Contains("login required") || e.Contains("requires authentication") || e.Contains("log in") || e.Contains("cookies")) return "المحتوى ده محتاج تسجيل دخول ومينفعش يتحمّل.";
            if (e.Contains("http error 403") || e.Contains("forbidden")) return "الموقع رفض التنزيل. اضغط «تحديث الأدوات» وجرّب تاني.";
            if (e.Contains("http error 429") || e.Contains("too many requests")) return "الموقع ضاغط علينا دلوقتي. جرّب بعد شوية.";
            if (e.Contains("getaddrinfo") || e.Contains("timed out") || e.Contains("connection") || e.Contains("network is unreachable") || e.Contains("urlopen error")) return "مفيش اتصال بالإنترنت أو النت ضعيف. اتأكد وجرّب تاني.";
            if (e.Contains("no space left") || e.Contains("errno 28")) return "مفيش مساحة كفاية على الهارد.";
            if (e.Contains("permission denied") || e.Contains("access is denied")) return "مش قادر أحفظ في الفولدر ده. اختار فولدر تاني.";
            if (e.Contains("requested format is not available")) return "الجودة دي مش متاحة للفيديو ده. اختار «أعلى جودة».";
            return Generic;
        }

        /// <summary>The last "ERROR:" line, for the log.</summary>
        public static string LastError(string err)
        {
            var lines = (err ?? "").Split('\n').Select(l => l.Trim()).Where(l => l.StartsWith("ERROR", StringComparison.Ordinal)).ToList();
            return lines.Count > 0 ? lines[lines.Count - 1] : (err ?? "").Trim();
        }
    }
}
