// LMuse native messaging Windows entry point (compiled locally by setup script).
// This small binary exists because Chrome requires an executable, not a .mjs or
// a .cmd file. It does not interpret protocol messages or inspect any secrets:
// stdin/stdout are copied byte-for-byte between Chrome and the Node host.
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

internal static class LMuseNativeHost
{
    private static readonly string NodeExecutable = __NODE_EXE__;
    private static readonly string BridgeScript = __BRIDGE_FILE__;

    private static void Pipe(Stream source, Stream destination, bool closeDestination)
    {
        try
        {
            source.CopyTo(destination);
            destination.Flush();
        }
        catch (IOException)
        {
            // The browser or child process may already have closed the pipe.
        }
        finally
        {
            if (closeDestination) destination.Close();
        }
    }

    private static int Main()
    {
        try
        {
            using (var child = new Process())
            {
                child.StartInfo.FileName = NodeExecutable;
                child.StartInfo.Arguments = "\"" + BridgeScript + "\"";
                child.StartInfo.UseShellExecute = false;
                child.StartInfo.CreateNoWindow = true;
                child.StartInfo.RedirectStandardInput = true;
                child.StartInfo.RedirectStandardOutput = true;
                child.StartInfo.RedirectStandardError = true;
                if (!child.Start()) return 1;
                var input = new Thread(() => Pipe(Console.OpenStandardInput(), child.StandardInput.BaseStream, true));
                var errors = new Thread(() => Pipe(child.StandardError.BaseStream, Stream.Null, false));
                input.IsBackground = true;
                errors.IsBackground = true;
                input.Start();
                errors.Start();
                Pipe(child.StandardOutput.BaseStream, Console.OpenStandardOutput(), false);
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Exception)
        {
            // Never leak file paths, credentials or stack traces over stdout.
            return 1;
        }
    }
}
