# NYXON — قارئ بيانات برو كلوب من EA
#
# يشتغل من جهازك في البيت، باتصالك العادي، بترويسات صادقة.
# ما فيه تزوير ولا انتحال متصفح: الأداة تعرّف عن نفسها كما هي.
#
# المرحلة الأولى (هذي): يجيب البيانات الخام ويحفظها في ملفات،
# عشان نشوف شكلها الحقيقي ونبني عليها.
#
# التشغيل: اضغط مرتين على RUN-ME.bat

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$BASE = 'https://proclubs.ea.com/api/fc'
$UA   = 'NYXON-club-tool/1.0 (+https://github.com/antslyasl0-dotcom/nyxon)'
$OUT  = Join-Path $PSScriptRoot 'ea-raw'

function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
function Line { Say ('-' * 56) DarkGray }

Say ''
Say '  NYXON — قارئ بيانات برو كلوب' Yellow
Line

# ---------------------------------------------------------------- platform
Say ''
Say '  على أي جهاز تلعبون؟' White
Say '    1) بلايستيشن 5 / إكس بوكس سيريس   (الأحدث)' Gray
Say '    2) بلايستيشن 4 / إكس بوكس ون' Gray
Say '    3) كمبيوتر' Gray
Say '    4) نينتندو سويتش' Gray
$pick = Read-Host '  اكتب الرقم'

switch ($pick) {
  '1' { $platform = 'common-gen5' }
  '2' { $platform = 'common-gen4' }
  '3' { $platform = 'pc' }
  '4' { $platform = 'nx' }
  default { $platform = 'common-gen5'; Say '  (ما فهمت الرقم — بنجرب الأحدث)' DarkYellow }
}

$clubName = Read-Host '  اسم النادي كما هو مكتوب في اللعبة'
if ([string]::IsNullOrWhiteSpace($clubName)) { Say '  لازم اسم النادي.' Red; Read-Host '  اضغط Enter'; exit 1 }

New-Item -ItemType Directory -Force -Path $OUT | Out-Null

function Fetch($label, $url, $file) {
  Say ''
  Say "  [$label]" Cyan
  try {
    $r = Invoke-WebRequest -Uri $url -Headers @{ 'User-Agent' = $UA; 'Accept' = 'application/json' } `
                           -TimeoutSec 30 -UseBasicParsing
    $body = $r.Content
    $path = Join-Path $OUT $file
    [System.IO.File]::WriteAllText($path, $body, (New-Object System.Text.UTF8Encoding $false))
    Say ("  تم — " + $body.Length + " حرف، محفوظ في ea-raw\" + $file) Green
    return $body
  } catch {
    $msg = $_.Exception.Message
    $code = ''
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Say "  ما نجح. $code $msg" Red
    Add-Content -Path (Join-Path $OUT '_errors.txt') -Value "$label :: $code :: $msg" -Encoding UTF8
    return $null
  }
}

# ---------------------------------------------------------------- 1: search
$enc = [System.Uri]::EscapeDataString($clubName)
$search = Fetch 'البحث عن النادي' "$BASE/clubs/search?platform=$platform&clubName=$enc" 'search.json'

if (-not $search) {
  Line
  Say ''
  Say '  ما وصلنا لـEA.' Red
  Say '  لو الرقم 403 أو انقطع الاتصال: EA تحجب هذا النوع من الطلبات،' Gray
  Say '  وما فيه طريقة نظيفة نتجاوزها.' Gray
  Say ''
  Say '  أرسل محتوى ea-raw\_errors.txt وأقول لك وش صار بالضبط.' Yellow
  Say ''
  Read-Host '  اضغط Enter للإغلاق'
  exit 1
}

# ---------------------------------------------------------------- pick club
try { $clubs = $search | ConvertFrom-Json } catch { $clubs = $null }

$clubId = $null
if ($clubs) {
  $ids = @()
  foreach ($p in $clubs.PSObject.Properties) { $ids += $p.Name }
  if ($ids.Count -gt 0) {
    Say ''
    Say '  الأندية اللي لقيناها:' White
    $i = 1
    foreach ($id in $ids) {
      $nm = $clubs.$id.name
      if (-not $nm) { $nm = $clubs.$id.clubInfo.name }
      Say ("    $i) $nm   [$id]") Gray
      $i++
    }
    if ($ids.Count -eq 1) { $clubId = $ids[0] }
    else {
      $sel = Read-Host '  اكتب رقم ناديك'
      $n = 0; [void][int]::TryParse($sel, [ref]$n)
      if ($n -ge 1 -and $n -le $ids.Count) { $clubId = $ids[$n - 1] } else { $clubId = $ids[0] }
    }
  }
}

if (-not $clubId) {
  Say ''
  Say '  وصلنا رد من EA بس ما عرفنا نقرأ النادي منه.' DarkYellow
  Say '  أرسل ملف ea-raw\search.json وأنا أقرأه وأضبط الأداة.' Yellow
  Say ''
  Read-Host '  اضغط Enter للإغلاق'
  exit 0
}

Say ''
Say "  النادي: $clubId" Green
Line

# ---------------------------------------------------------------- the rest
Fetch 'مباريات الدوري'   "$BASE/clubs/matches?matchType=leagueMatch&platform=$platform&clubIds=$clubId" 'matches-league.json' | Out-Null
Fetch 'المباريات الودية' "$BASE/clubs/matches?matchType=playoffMatch&platform=$platform&clubIds=$clubId" 'matches-playoff.json' | Out-Null
Fetch 'إحصائيات الأعضاء' "$BASE/members/stats?platform=$platform&clubId=$clubId"                        'members.json' | Out-Null
Fetch 'إجمالي النادي'    "$BASE/clubs/overallStats?platform=$platform&clubIds=$clubId"                  'overall.json' | Out-Null

Line
Say ''
Say '  خلص.' Green
Say ''
Say '  الملفات محفوظة في مجلد:' White
Say "    $OUT" Yellow
Say ''
Say '  أرسل الملفات لكلود، وهو يبني لك ملف الاستيراد' White
Say '  اللي تحطه في التطبيق من: الإدارة ← نسخة احتياطية ← استورد.' White
Say ''
try { Start-Process explorer.exe $OUT } catch {}
Read-Host '  اضغط Enter للإغلاق'
