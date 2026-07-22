# Genera panoramicas de prueba con marcas de rumbo, para verificar el visor
# y el pipeline de metadatos sin depender de una foto real.
Add-Type -AssemblyName System.Drawing

function New-Pano {
    param([int]$Width, [int]$Height, [string]$Path, [string]$Label)

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'

    # Cielo arriba, suelo abajo, con el horizonte a la mitad exacta.
    $sky = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, [int]($Height / 2))),
        [System.Drawing.Color]::FromArgb(38, 86, 168),
        [System.Drawing.Color]::FromArgb(150, 200, 235))
    $g.FillRectangle($sky, 0, 0, $Width, [int]($Height / 2))

    $ground = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, [int]($Height / 2))),
        (New-Object System.Drawing.Point(0, $Height)),
        [System.Drawing.Color]::FromArgb(96, 118, 74),
        [System.Drawing.Color]::FromArgb(42, 52, 34))
    $g.FillRectangle($ground, 0, [int]($Height / 2), $Width, [int]($Height / 2))

    $horizon = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 240, 120), 3)
    $g.DrawLine($horizon, 0, [int]($Height / 2), $Width, [int]($Height / 2))

    # Un meridiano cada 30 grados, etiquetado. Sirve para detectar espejados
    # y para confirmar que el punto de vista inicial cae donde decimos.
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 255, 255), 2)
    $font = New-Object System.Drawing.Font('Segoe UI', [float]($Height / 14), [System.Drawing.FontStyle]::Bold)
    $text = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 0, 0, 0))

    for ($deg = 0; $deg -lt 360; $deg += 30) {
        $x = [int]($Width * $deg / 360)
        $g.DrawLine($pen, $x, 0, $x, $Height)
        $s = "$deg"
        $sz = $g.MeasureString($s, $font)
        $g.FillRectangle($shadow, $x + 6, [int]($Height / 2) - $sz.Height - 8, $sz.Width + 8, $sz.Height + 4)
        $g.DrawString($s, $font, $text, [float]($x + 10), [float]([int]($Height / 2) - $sz.Height - 6))
    }

    $big = New-Object System.Drawing.Font('Segoe UI', [float]($Height / 9), [System.Drawing.FontStyle]::Bold)
    $g.DrawString($Label, $big, $text, [float]($Width * 0.02), [float]($Height * 0.62))

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]92)
    $bmp.Save($Path, $codec, $params)

    $g.Dispose(); $bmp.Dispose()
    "{0}  ({1}x{2}, {3:N0} KB)" -f (Split-Path $Path -Leaf), $Width, $Height, ((Get-Item $Path).Length / 1KB)
}

$dir = Join-Path $PSScriptRoot '..\public\samples'
New-Item -ItemType Directory -Force $dir | Out-Null
$dir = (Resolve-Path $dir).Path

# Equirectangular perfecta (2:1) y franja tipo panoramica de celular (4:1).
New-Pano -Width 2048 -Height 1024 -Path (Join-Path $dir 'equirect-2048.jpg') -Label 'EQUIRECT 2:1'
New-Pano -Width 4096 -Height 1024 -Path (Join-Path $dir 'strip-4096.jpg') -Label 'FRANJA 4:1'
