Add-Type -AssemblyName System.Drawing
$src = 'E:\xunwu\MusicFreeApp\MusicFree\android\app\src\main\res\drawable-nodpi\splashscreen_icon.png'
$bmp = New-Object System.Drawing.Bitmap($src)
$w = $bmp.Width; $h = $bmp.Height
$rect = New-Object System.Drawing.Rectangle 0,0,$w,$h
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data)
$note = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$nData = $note.LockBits((New-Object System.Drawing.Rectangle 0,0,$w,$h), [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$nStride = $nData.Stride
$nBytes = New-Object byte[] ($nStride * $h)
$minX=99999;$minY=99999;$maxX=-1;$maxY=-1
for ($y=0; $y -lt $h; $y++) {
  $row = $y * $stride; $nRow = $y * $nStride
  for ($x=0; $x -lt $w; $x++) {
    $i = $row + $x*4
    $r = $bytes[$i+2]; $g = $bytes[$i+1]; $b = $bytes[$i]; $a = $bytes[$i+3]
    if ($a -gt 200 -and $r -gt 228 -and $g -gt 228 -and $b -gt 228) {
      $nBytes[$nRow + $x*4] = 255; $nBytes[$nRow + $x*4 + 1] = 255; $nBytes[$nRow + $x*4 + 2] = 255; $nBytes[$nRow + $x*4 + 3] = 255
      if ($x -lt $minX){$minX=$x}; if ($x -gt $maxX){$maxX=$x}; if ($y -lt $minY){$minY=$y}; if ($y -gt $maxY){$maxY=$y}
    }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($nBytes, 0, $nData.Scan0, $nBytes.Length)
$note.UnlockBits($nData)
Write-Output "NOTE BBOX: $minX,$minY -> $maxX,$maxY"
$bw = $maxX - $minX + 1; $bh = $maxY - $minY + 1
$densities = @{ 'xxxhdpi'=432; 'xxhdpi'=324; 'xhdpi'=216; 'hdpi'=162; 'mdpi'=108 }
foreach ($k in $densities.Keys) {
  $S = $densities[$k]
  $scale = ($S * 0.66) / [Math]::Max($bw, $bh)
  $drawW = [int][Math]::Round($bw * $scale); $drawH = [int][Math]::Round($bh * $scale)
  $out = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $dx = [int][Math]::Round(($S - $drawW)/2); $dy = [int][Math]::Round(($S - $drawH)/2)
  $srcRect = New-Object System.Drawing.Rectangle $minX, $minY, $bw, $bh
  $dstRect = New-Object System.Drawing.Rectangle $dx, $dy, $drawW, $drawH
  $g.DrawImage($note, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $path = "E:\xunwu\MusicFreeApp\MusicFree\android\app\src\main\res\mipmap-$k\ic_launcher_foreground.png"
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  Write-Output "SAVED $k ${S}x${S} note=${drawW}x${drawH} at $dx,$dy"
}
$note.Dispose(); $bmp.Dispose()
