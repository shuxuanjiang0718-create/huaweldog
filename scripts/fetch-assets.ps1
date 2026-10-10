$ErrorActionPreference = 'Stop'
$assetRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\assets'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
$specifications = @(
    @{ Asset='asphalt_02'; Channel='Diffuse'; Extension='jpg'; Name='asphalt-color.jpg' },
    @{ Asset='asphalt_02'; Channel='nor_gl'; Extension='jpg'; Name='asphalt-normal.jpg' },
    @{ Asset='asphalt_02'; Channel='Rough'; Extension='jpg'; Name='asphalt-roughness.jpg' },
    @{ Asset='kloofendal_48d_partly_cloudy_puresky'; Channel='hdri'; Extension='hdr'; Name='daylight.hdr' },
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
    $metadata = $metadataCache[$assetName].($specification.Channel).'1k'.($specification.Extension)
    $assetPath = Join-Path $assetRoot $specification.Name
    if (-not (Test-Path -LiteralPath $assetPath)) {
        Invoke-WebRequest -Uri $metadata.url -OutFile $assetPath -TimeoutSec 80
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
