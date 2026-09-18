const { execFile } = require('node:child_process')

function runPowerShell(script, args = []) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, ...args], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr?.trim() || error.message))
      resolve(stdout.trim())
    })
  })
}

function b64(value) { return Buffer.from(String(value), 'utf8').toString('base64') }

async function listWindowsPrinters() {
  if (process.platform !== 'win32') return []
  const script = `Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline,PrinterStatus,PortName,DriverName | ConvertTo-Json -Compress`
  const raw = await runPowerShell(script)
  if (!raw) return []
  const parsed = JSON.parse(raw)
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.map(p => ({
    name: String(p.Name || ''),
    isDefault: Boolean(p.Default),
    workOffline: Boolean(p.WorkOffline),
    status: Number(p.PrinterStatus || 0),
    portName: String(p.PortName || ''),
    driverName: String(p.DriverName || ''),
  })).filter(p => p.name)
}

async function rawPrint(printerName, bytes) {
  if (process.platform !== 'win32') throw new Error('الطباعة الخام للأجهزة مدعومة حاليًا على Windows فقط')
  const name64 = b64(printerName)
  const data64 = Buffer.from(bytes).toString('base64')
  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true)] public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, IntPtr pDocInfo);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
'@
$name=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${name64}'))
$data=[Convert]::FromBase64String('${data64}')
$h=[IntPtr]::Zero
if(-not [RawPrinter]::OpenPrinter($name,[ref]$h,[IntPtr]::Zero)){ throw 'تعذر فتح الطابعة' }
try {
  $doc = New-Object IntPtr[] 3
  $doc[0]=[Runtime.InteropServices.Marshal]::StringToHGlobalAnsi('KAYAN POS')
  $doc[1]=[Runtime.InteropServices.Marshal]::StringToHGlobalAnsi('RAW')
  $docPtr=[Runtime.InteropServices.Marshal]::AllocHGlobal([IntPtr]::Size*3)
  [Runtime.InteropServices.Marshal]::WriteIntPtr($docPtr,0,$doc[0])
  [Runtime.InteropServices.Marshal]::WriteIntPtr($docPtr,[IntPtr]::Size,$doc[1])
  [Runtime.InteropServices.Marshal]::WriteIntPtr($docPtr,[IntPtr]::Size*2,[IntPtr]::Zero)
  try {
    if(-not [RawPrinter]::StartDocPrinter($h,1,$docPtr)){ throw 'تعذر بدء مستند الطباعة' }
    try {
      if(-not [RawPrinter]::StartPagePrinter($h)){ throw 'تعذر بدء صفحة الطباعة' }
      try {
        $written=0
        if(-not [RawPrinter]::WritePrinter($h,$data,$data.Length,[ref]$written)){ throw 'تعذر إرسال بيانات الطباعة' }
        if($written -ne $data.Length){ throw 'لم تُرسل كامل بيانات الطباعة' }
      } finally { [RawPrinter]::EndPagePrinter($h) | Out-Null }
    } finally { [RawPrinter]::EndDocPrinter($h) | Out-Null }
  } finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($doc[0])
    [Runtime.InteropServices.Marshal]::FreeHGlobal($doc[1])
    [Runtime.InteropServices.Marshal]::FreeHGlobal($docPtr)
  }
} finally { [RawPrinter]::ClosePrinter($h) | Out-Null }
`
  await runPowerShell(script)
  return { ok: true }
}

module.exports = { listWindowsPrinters, rawPrint }
