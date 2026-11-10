# Generates PersonalBlog.ico: a fluorescent paper sheet with a black "J", in the site's Paste-up style.
# Run once (Install-Shortcut.ps1 calls it if the icon is missing).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot 'PersonalBlog.ico'
$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = @()

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)

    $ink = [System.Drawing.Color]::FromArgb(255, 28, 24, 20)
    $fluoro = [System.Drawing.Color]::FromArgb(255, 236, 246, 34)
    $pad = [Math]::Max(1, [int]($s * 0.06))
    $off = [Math]::Max(1, [int]($s * 0.07))
    $w = $s - 2 * $pad - $off

    # hard ink offset, then the fluorescent sheet, slightly rotated like the hero
    $g.TranslateTransform($s / 2, $s / 2)
    $g.RotateTransform(-4)
    $g.TranslateTransform(-$s / 2, -$s / 2)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $ink), $pad + $off, $pad + $off, $w, $w)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $fluoro), $pad, $pad, $w, $w)

    $fontName = 'Impact'
    $font = New-Object System.Drawing.Font $fontName, ([single]($w * 0.72)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF ([single]$pad), ([single]($pad + $w * 0.04)), ([single]$w), ([single]$w)
    $g.DrawString('J', $font, (New-Object System.Drawing.SolidBrush $ink), $rect, $fmt)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += , $ms.ToArray()
    $bmp.Dispose()
}

# Write an ICO container holding the PNG images.
$fs = [System.IO.File]::Create($out)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]; $len = $pngs[$i].Length
    $dim = if ($s -ge 256) { 0 } else { $s }
    $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$len); $bw.Write([UInt32]$offset)
    $offset += $len
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Close()
Write-Host "Wrote $out"
