param(
  [switch]$Fix
)

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$includeExt = @("*.md", "*.mdx", "*.txt", "*.rst", "*.adoc")
$excludePathPattern = "\\node_modules\\|\\.git\\|\\dist-standalone\\|\\.turbo\\"

$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$gbk = [System.Text.Encoding]::GetEncoding(936)

$files = Get-ChildItem -Recurse -File -Include $includeExt |
  Where-Object { $_.FullName -notmatch $excludePathPattern }

$total = 0
$bomCount = 0
$fixedCount = 0
$writeDeniedCount = 0
$invalidUtf8Count = 0
$fallbackConvertedCount = 0
$suspectCount = 0
$invalidUtf8Files = New-Object System.Collections.Generic.List[string]
$suspectFiles = New-Object System.Collections.Generic.List[string]
$writeDeniedFiles = New-Object System.Collections.Generic.List[string]

foreach ($f in $files) {
  $total++
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
  if ($hasBom) { $bomCount++ }

  $text = $null
  $isValidUtf8 = $true
  try {
    $text = $utf8Strict.GetString($bytes)
  } catch {
    if ($Fix) {
      try {
        $text = $gbk.GetString($bytes)
        if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
          $text = $text.Substring(1)
        }
        [System.IO.File]::WriteAllText($f.FullName, $text, $utf8NoBom)
        $fixedCount++
        $fallbackConvertedCount++
      } catch [System.UnauthorizedAccessException] {
        $writeDeniedCount++
        $writeDeniedFiles.Add($f.FullName) | Out-Null
      } catch {
        $isValidUtf8 = $false
        $invalidUtf8Count++
        $invalidUtf8Files.Add($f.FullName) | Out-Null
      }
    } else {
      $isValidUtf8 = $false
      $invalidUtf8Count++
      $invalidUtf8Files.Add($f.FullName) | Out-Null
    }
  }

  if ($isValidUtf8 -and  $text.Contains([string][char]0xFFFD)) {
    $suspectCount++
    $suspectFiles.Add($f.FullName) | Out-Null
  }

  if ($Fix -and $isValidUtf8 -and $hasBom) {
    if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
      $text = $text.Substring(1)
    }
    try {
      [System.IO.File]::WriteAllText($f.FullName, $text, $utf8NoBom)
      $fixedCount++
    } catch [System.UnauthorizedAccessException] {
      $writeDeniedCount++
      $writeDeniedFiles.Add($f.FullName) | Out-Null
    }
  }
}

Write-Output "DOC_FILES=$total"
Write-Output "BOM_FILES=$bomCount"
Write-Output "INVALID_UTF8_FILES=$invalidUtf8Count"
Write-Output "SUSPECT_MOJIBAKE_FILES=$suspectCount"
if ($Fix) {
  Write-Output "FIXED_TO_UTF8_NO_BOM=$fixedCount"
  Write-Output "FALLBACK_GBK_CONVERTED=$fallbackConvertedCount"
  Write-Output "WRITE_DENIED_FILES=$writeDeniedCount"
}

if ($invalidUtf8Files.Count -gt 0) {
  Write-Output "INVALID_UTF8_FILE_LIST_START"
  $invalidUtf8Files | ForEach-Object { Write-Output $_ }
  Write-Output "INVALID_UTF8_FILE_LIST_END"
}

if ($suspectFiles.Count -gt 0) {
  Write-Output "SUSPECT_MOJIBAKE_FILE_LIST_START"
  $suspectFiles | ForEach-Object { Write-Output $_ }
  Write-Output "SUSPECT_MOJIBAKE_FILE_LIST_END"
}

if ($writeDeniedFiles.Count -gt 0) {
  Write-Output "WRITE_DENIED_FILE_LIST_START"
  $writeDeniedFiles | ForEach-Object { Write-Output $_ }
  Write-Output "WRITE_DENIED_FILE_LIST_END"
}
