using System;
using System.Drawing;
using System.Windows.Forms;

namespace DiscordDummy
{
    class GameWindow : Form
    {
        public GameWindow(string title)
        {
            Text = title;
            ShowInTaskbar = false;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-32000, -32000);
            Size = new Size(320, 180);
        }

        protected override bool ShowWithoutActivation { get { return true; } }
    }

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string title = args != null && args.Length > 0 ? string.Join(" ", args) : "Discord Game";
            Application.Run(new GameWindow(title));
        }
    }
}
