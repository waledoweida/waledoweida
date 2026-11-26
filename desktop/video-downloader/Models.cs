using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Windows.Media;

namespace VideoDownloader
{
    public abstract class Observable : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        protected void Set<T>(ref T field, T value, [CallerMemberName] string name = null)
        {
            if (Equals(field, value)) return;
            field = value;
            Raise(name);
        }

        protected void Raise(params string[] names)
        {
            foreach (var n in names) PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(n));
        }
    }

    public enum ItemState { Queued, Running, Processing, Done, Failed, Canceled }

    /// <summary>One row in the downloads list.</summary>
    public class DownloadItem : Observable
    {
        public DownloadRequest Request;
        public Process Process;
        public bool CancelRequested;

        string _title = "";
        public string Title { get => _title; set => Set(ref _title, value); }

        public string Kind => Request?.Describe() ?? "";
        public string Glyph => Request != null && Request.Audio ? "" : "";

        ImageSource _thumb;
        public ImageSource Thumb { get => _thumb; set { Set(ref _thumb, value); Raise(nameof(HasThumb)); } }
        public bool HasThumb => _thumb != null;

        double _percent;
        public double Percent { get => _percent; set => Set(ref _percent, value); }

        string _details = "";
        public string Details { get => _details; set => Set(ref _details, value); }

        string _playlistPos = "";
        public string PlaylistPos { get => _playlistPos; set { Set(ref _playlistPos, value); Raise(nameof(HasPlaylistPos)); } }
        public bool HasPlaylistPos => !string.IsNullOrEmpty(_playlistPos);

        public string FilePath;
        public string Error = "";
        public int Finished;      // files finished (playlists)

        ItemState _state;
        public ItemState State
        {
            get => _state;
            set
            {
                Set(ref _state, value);
                Raise(nameof(StatusText), nameof(IsActive), nameof(IsDone), nameof(IsFailed), nameof(CanCancel),
                      nameof(CanRetry), nameof(CanRemove), nameof(ShowBar), nameof(Indeterminate), nameof(StatusBrush));
            }
        }

        public string StatusText
        {
            get
            {
                switch (State)
                {
                    case ItemState.Queued: return "في الانتظار";
                    case ItemState.Running: return "بيتحمّل";
                    case ItemState.Processing: return "بيجهّز الملف";
                    case ItemState.Done: return Request != null && Request.Playlist ? "خلص • " + Finished + " ملف" : "خلص";
                    case ItemState.Failed: return Error;
                    case ItemState.Canceled: return "اتلغى";
                }
                return "";
            }
        }

        public Brush StatusBrush
        {
            get
            {
                var app = System.Windows.Application.Current;
                switch (State)
                {
                    case ItemState.Done: return (Brush)app.Resources["Green"];
                    case ItemState.Failed: return (Brush)app.Resources["Red"];
                    case ItemState.Running:
                    case ItemState.Processing: return (Brush)app.Resources["Gold"];
                    default: return (Brush)app.Resources["Muted"];
                }
            }
        }

        public bool IsActive => State == ItemState.Running || State == ItemState.Processing || State == ItemState.Queued;
        public bool IsDone => State == ItemState.Done;
        public bool IsFailed => State == ItemState.Failed;
        public bool CanCancel => IsActive;
        public bool CanRetry => State == ItemState.Failed || State == ItemState.Canceled;
        public bool CanRemove => !IsActive;
        public bool ShowBar => IsActive;
        public bool Indeterminate => State == ItemState.Queued || State == ItemState.Processing || (State == ItemState.Running && _percent <= 0);

        public void Touch() => Raise(nameof(Indeterminate), nameof(StatusText));
    }

    public class Option
    {
        public string Text { get; set; }
        public string Hint { get; set; }
        public bool HasHint => !string.IsNullOrEmpty(Hint);
        public int Height;
        public string Key;
        public override string ToString() => Text;
    }
}
