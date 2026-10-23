Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path $PSScriptRoot "..\extension\icons"
if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
}

$sizes = @(16, 32, 48, 128)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Crimson/Rose gradient background (#e11d48 to #f43f5e)
    $rect = New-Object System.Drawing.Rectangle 0, 0, $s, $s
    $c1 = [System.Drawing.Color]::FromArgb(255, 225, 29, 72)
    $c2 = [System.Drawing.Color]::FromArgb(255, 244, 63, 94)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45.0

    # Draw rounded rectangle
    $radius = [int]($s * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [Math]::Max(2, $radius * 2)
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($s - $d - 1, 0, $d, $d, 270, 90)
    $path.AddArc($s - $d - 1, $s - $d - 1, $d, $d, 0, 90)
    $path.AddArc(0, $s - $d - 1, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)

    # Draw white stream drop arrow
    $penWidth = [float]([Math]::Max(1.5, $s * 0.08))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $penWidth
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Vertical stem
    $midX = [float]($s * 0.5)
    $topY = [float]($s * 0.24)
    $arrowY = [float]($s * 0.56)
    $g.DrawLine($pen, $midX, $topY, $midX, $arrowY)

    # Arrow head
    $wingX = [float]($s * 0.16)
    $wingY = [float]($s * 0.14)
    $g.DrawLine($pen, $midX - $wingX, $arrowY - $wingY, $midX, $arrowY)
    $g.DrawLine($pen, $midX + $wingX, $arrowY - $wingY, $midX, $arrowY)

    # Wave curve at bottom
    $waveY = [float]($s * 0.72)
    $waveW = [float]($s * 0.22)
    $g.DrawLine($pen, $midX - $waveW, $waveY, $midX + $waveW, $waveY)

    $outPath = Join-Path $iconDir "icon$s.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $outPath"
}
