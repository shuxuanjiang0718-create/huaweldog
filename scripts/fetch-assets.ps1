$ErrorActionPreference = 'Stop'
$assetRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\assets'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
$specifications = @(
    @{ Asset='asphalt_02'; Channel='Diffuse'; Extension='jpg'; Name='asphalt-color.jpg' },
    @{ Asset='asphalt_02'; Channel='nor_gl'; Extension='jpg'; Name='asphalt-normal.jpg'; Resolution='2k' },
    @{ Asset='asphalt_02'; Channel='Rough'; Extension='jpg'; Name='asphalt-roughness.jpg' },
    @{ Asset='kloofendal_48d_partly_cloudy_puresky'; Channel='hdri'; Extension='hdr'; Name='daylight.hdr'; Resolution='2k' },
    @{ Asset='rocky_terrain'; Channel='Diffuse'; Extension='jpg'; Name='terrain-color.jpg' },
    @{ Asset='rocky_terrain'; Channel='nor_gl'; Extension='jpg'; Name='terrain-normal.jpg' }
)
$metadataCache = @{}
$records = @()
foreach ($specification in $specifications) {
    $assetName = $specification.Asset
    if (-not $metadataCache.ContainsKey($assetName)) {
        $metadataCache[$assetName] = Invoke-RestMethod -Uri ('https://api.polyhaven.com/files/' + $assetName) -TimeoutSec 30
    }
    $assetResolution = if ($specification.Resolution) { $specification.Resolution } else { '1k' }
    $metadata = $metadataCache[$assetName].($specification.Channel).($assetResolution).($specification.Extension)
    $assetPath = Join-Path $assetRoot $specification.Name
    $requiresDownload = -not (Test-Path -LiteralPath $assetPath)
    if (-not $requiresDownload) { $requiresDownload = (Get-FileHash -LiteralPath $assetPath -Algorithm MD5).Hash.ToLowerInvariant() -ne $metadata.md5 }
    if ($requiresDownload) {
        $downloadPath = $assetPath + '.download'
        Invoke-WebRequest -Uri $metadata.url -OutFile $downloadPath -TimeoutSec 80
        if ((Get-FileHash -LiteralPath $downloadPath -Algorithm MD5).Hash.ToLowerInvariant() -ne $metadata.md5) { throw ('Download checksum mismatch: ' + $specification.Name) }
        Move-Item -LiteralPath $downloadPath -Destination $assetPath -Force
    }
    $checksum = (Get-FileHash -LiteralPath $assetPath -Algorithm MD5).Hash.ToLowerInvariant()
    if ($checksum -ne $metadata.md5) { throw ('Checksum mismatch: ' + $specification.Name) }
    $records += @{
        file=$specification.Name
        source=('https://polyhaven.com/a/' + $assetName)
        download=$metadata.url
        license='CC0-1.0'
        bytes=(Get-Item -LiteralPath $assetPath).Length
        sha256=(Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    Write-Output ('Verified: ' + $specification.Name)
}
$records | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $assetRoot 'sources.json') -Encoding utf8
