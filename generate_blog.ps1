# generate_blog.ps1
# Automates the pre-rendering of blog posts for Pause & Move website (Bilingual & SEO optimized)

param(
    [switch]$IncludeDrafts
)

$rootDir = $PSScriptRoot
$blogJsonPath = Join-Path $rootDir "blog.json"
$contentJsonPath = Join-Path $rootDir "content.json"
$indexHtmlPath = Join-Path $rootDir "index.html"
$journalDir = Join-Path $rootDir "journal"
$legacyDeDir = Join-Path $rootDir "de"

# Verify files exist
if (-not (Test-Path $blogJsonPath) -or -not (Test-Path $contentJsonPath) -or -not (Test-Path $indexHtmlPath)) {
    Write-Error "Error: Core files (blog.json, content.json, index.html) not found in script directory."
    Exit 1
}

Write-Host "Loading data files..." -ForegroundColor Cyan
$blogData = [System.IO.File]::ReadAllText($blogJsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$contentData = [System.IO.File]::ReadAllText($contentJsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$templateHtml = [System.IO.File]::ReadAllText($indexHtmlPath, [System.Text.Encoding]::UTF8)

# Helper: Resolve nested dot notation in JSON translation
function Get-Translation($langData, $key) {
    $parts = $key.Split('.')
    $current = $langData
    foreach ($part in $parts) {
        if ($null -eq $current) { return $null }
        if ($part -match '^\d+$') {
            $idx = [int]$part
            $current = $current[$idx]
        } else {
            $current = $current.$part
        }
    }
    return $current
}

# Helper: Translate elements with data-copy in HTML
function Translate-HtmlString($html, $langData) {
    $callback = {
        param($match)
        $fullTag = $match.Groups[1].Value
        $tagName = $match.Groups[2].Value
        $key = $match.Groups[3].Value
        $content = $match.Groups[4].Value
        $closeTag = $match.Groups[5].Value
        
        $translated = Get-Translation $langData $key
        if ($null -eq $translated) {
            return $match.Value
        }
        
        if ($tagName -eq "input" -or $tagName -eq "textarea") {
            # Replace placeholder attribute instead of content
            if ($fullTag -match 'placeholder="[^"]*"') {
                $newTag = $fullTag -replace 'placeholder="[^"]*"', "placeholder=`"$translated`""
            } else {
                $newTag = $fullTag -replace '(/?>)$', " placeholder=`"$translated`" `$1"
            }
            return $newTag + $content + $closeTag
        } else {
            return $fullTag + $translated + $closeTag
        }
    }
    
    # Matches tags containing data-copy, capturing opening tag, tag name, key, inner content, and closing tag
    $regex = [regex]'(?s)(<([a-zA-Z0-9]+)\b[^>]*data-copy="([^"]+)"[^>]*>)(.*?)(<\/\s*\2\s*>)'
    return $regex.Replace($html, $callback)
}

# Helper: Parse date strings (e.g. "June 2026" or "Juni 2026") into DateTime objects for sorting
function Get-ArticleDate($dateStr) {
    if ([string]::IsNullOrEmpty($dateStr)) {
        return [DateTime]::MinValue
    }
    
    $parts = $dateStr.Trim() -split '\s+'
    if ($parts.Count -lt 2) {
        return [DateTime]::MinValue
    }
    
    $monthStr = $parts[0].ToLower()
    $year = [int]$parts[1]
    
    # Month map for EN and DE
    $monthMap = @{
        "january" = 1; "januar" = 1
        "february" = 2; "februar" = 2
        "march" = 3; "mã¤rz" = 3; "mãrz" = 3; "märz" = 3; "maerz" = 3
        "april" = 4
        "may" = 5; "mai" = 5
        "june" = 6; "juni" = 6
        "july" = 7; "juli" = 7
        "august" = 8
        "september" = 9
        "october" = 10; "oktober" = 10
        "november" = 11
        "december" = 12; "dezember" = 12
    }
    
    $month = 1
    if ($monthMap.ContainsKey($monthStr)) {
        $month = $monthMap[$monthStr]
    }
    
    try {
        return [DateTime]::new($year, $month, 1)
    } catch {
        return [DateTime]::MinValue
    }
}

# Set up output directories
$enDir = Join-Path $journalDir "en"
$deDir = Join-Path $journalDir "de"

if (-not (Test-Path $journalDir)) { New-Item -ItemType Directory -Path $journalDir | Out-Null }
if (-not (Test-Path $enDir)) { New-Item -ItemType Directory -Path $enDir | Out-Null }
if (-not (Test-Path $deDir)) { New-Item -ItemType Directory -Path $deDir | Out-Null }

$languages = @("en", "de")

foreach ($lang in $languages) {
    Write-Host "Processing language: $lang" -ForegroundColor Cyan
    $langBlog = $blogData.$lang
    $langContent = $contentData.$lang
    
    $articles = if ($IncludeDrafts) {
        $langBlog.articles | Sort-Object { Get-ArticleDate $_.date } -Descending
    } else {
        $langBlog.articles | Where-Object { $null -eq $_.published -or $_.published -ne $false } | Sort-Object { Get-ArticleDate $_.date } -Descending
    }
    $categories = $langBlog.categories
    
    # 1. Translate the base layout (Nav, Drawer, Modals, Footer)
    $translatedLayout = Translate-HtmlString $templateHtml $langContent
    
    # Pre-render each article
    foreach ($article in $articles) {
        Write-Host "  Pre-rendering: $($article.title) ($($article.id))" -ForegroundColor DarkCyan
        
        # Determine translations for elements inside the article detail view (manual textContent)
        if ($lang -eq "en") {
            $shareTitle = "Share this article:"
            $shareCopy = "Copy Link"
            $subTitle = "Subscribe to our newsletter"
            $subDesc = "Get gentle reflections, wellness insights, and breathing practices straight to your inbox."
            $subNamePlaceholder = "Your name"
            $subPlaceholder = "Your email address"
            $subPhonePlaceholder = "Phone / SMS (optional)"
            $subSubmit = "Subscribe"
            $sidebarCategoriesTitle = "Categories"
            $sidebarRecentTitle = "Recent Posts"
            $backBtnText = "&larr; Back to Journal"
            $readTimeSuffix = "read"
            $categoryName = $categories.$($article.categoryId)
            if ($null -eq $categoryName) { $categoryName = $article.categoryId }
        } else {
            $shareTitle = "Diesen Artikel teilen:"
            $shareCopy = "Link kopieren"
            $subTitle = "Newsletter abonnieren"
            $subDesc = "Erhalten Sie wertvolle Einblicke in Gesundheit, Wohlbefinden und Atem&uuml;bungen direkt in Ihr Postfach."
            $subNamePlaceholder = "Ihr Name"
            $subPlaceholder = "Ihre E-Mail-Adresse"
            $subPhonePlaceholder = "Telefon / SMS (optional)"
            $subSubmit = "Abonnieren"
            $sidebarCategoriesTitle = "Kategorien"
            $sidebarRecentTitle = "Neueste Beitr&auml;ge"
            $backBtnText = "&larr; Zur&uuml;ck zum Journal"
            $readTimeSuffix = "Lesezeit"
            $categoryName = $categories.$($article.categoryId)
            if ($null -eq $categoryName) { $categoryName = $article.categoryId }
        }
        
        # Calculate Sidebar Categories HTML
        $sidebarCategoriesHtml = ""
        foreach ($catKey in $categories.psobject.Properties.Name) {
            if ($catKey -ne "all") {
                $count = ($articles | Where-Object { $_.categoryId -eq $catKey -or ($null -ne $_.categoryIds -and $_.categoryIds -contains $catKey) }).Count
                $catName = $categories.$catKey
                $sidebarCategoriesHtml += "          <li class=`"sidebar-category-item`" onclick=`"window.location.href='../../index.html#blog-$catKey'`">`n"
                $sidebarCategoriesHtml += "            <span>$catName</span>`n"
                $sidebarCategoriesHtml += "            <span class=`"sidebar-category-count`">$count</span>`n"
                $sidebarCategoriesHtml += "          </li>`n"
            }
        }
        
        # Calculate Sidebar Recent Posts HTML (latest 3 excluding current, or just first 3 if none other)
        $recentArticles = $articles | Where-Object { $_.id -ne $article.id }
        if ($recentArticles.Count -eq 0) { $recentArticles = $articles }
        # Limit to 3
        $recentLimit = [System.Math]::Min(3, $recentArticles.Count)
        
        $sidebarRecentHtml = ""
        for ($i = 0; $i -lt $recentLimit; $i++) {
            $rec = $recentArticles[$i]
            $sidebarRecentHtml += "          <a href=`"$($rec.id)`" class=`"sidebar-recent-item`" style=`"text-decoration: none; color: inherit; display: flex;`">`n"
            $sidebarRecentHtml += "            <div class=`"sidebar-recent-thumb`">`n"
            $sidebarRecentHtml += "              <img src=`"$($rec.image)`" alt=`"$($rec.title)`" loading=`"lazy`" />`n"
            $sidebarRecentHtml += "            </div>`n"
            $sidebarRecentHtml += "            <div class=`"sidebar-recent-info`">`n"
            $sidebarRecentHtml += "              <h4>$($rec.title)</h4>`n"
            $sidebarRecentHtml += "              <span class=`"sidebar-recent-date`">$($rec.date)</span>`n"
            $sidebarRecentHtml += "            </div>`n"
            $sidebarRecentHtml += "          </a>`n"
        }
        
        # Format Article Body Paragraphs HTML
        $paragraphsHtml = ""
        foreach ($p in $article.content) {
            $paragraphsHtml += "          <p>$p</p>`n"
        }
        
        # Construct pre-rendered <section id="article-detail">
        if ($article.id -eq "one-of-basels-ten-best" -or $article.layout -eq "10best") {
            if ($lang -eq "en") {
                $tbEyebrow = "News"
                $tbSealEyebrow = "10Best &middot; Basel"
                $tbSealTitle = "Selected as one of the ten best in Basel"
                $tbSealDesc = "A recognition based on personal vetting, not advertising budgets."
                $tbSealLink = "View our profile &rarr;"
                $tbLead = "I have some news to share, and I wanted you to hear it from me first. Pause &amp; Move has been selected for 10Best, a Swiss platform that lists only the ten best providers per industry and canton. I'm honoured to be one of the ten in Basel."
                $tbH3_1 = "Why this matters to me"
                $tbP1 = "Places on 10Best can't be bought. The selection is made by people: a phone conversation, a personal interview, a structured questionnaire, independent research into client feedback, and a closing conversation with honest feedback. What counts is quality, values and humanity, not size or turnover."
                $tbQuote = "A good treatment is one that makes the client stronger &mdash; and strength is achieved through experience and awareness."
                $tbP2 = "That's what means the most. What I care about isn't the number of sessions I give. It's whether you leave with something lasting."
                $tbH3_2 = "Thank you"
                $tbP3 = "This belongs to everyone who has trusted me with their body, their questions and their time. Whether you came once for a shoulder that wouldn't let go or have been coming for months, you're part of why this practice is what it is. If you've left feedback or recommended me to a friend, thank you especially."
                $tbH3_3 = "What stays the same"
                $tbP4 = "Nothing changes in how I work. Every session is still built around what you bring that day, whether that's classic massage, Shiatsu, Tuina, Connected Movement or Qigong. And if I'm not the right fit, I'll still tell you honestly."
                $tbCta = "Book a session"
                $tbSign = "With gratitude, Michael"
                $tbByline = "By Michael Guralnik &middot; $($article.date) <b>$($article.readTime.ToUpper())</b>"
            } else {
                $tbEyebrow = "Neu in der Praxis"
                $tbSealEyebrow = "10Best &middot; Basel"
                $tbSealTitle = "Ausgezeichnet als eine der zehn besten Praxen in Basel"
                $tbSealDesc = "Eine Anerkennung basierend auf pers&ouml;nlicher Pr&uuml;fung, nicht auf Werbebudgets."
                $tbSealLink = "Unser Profil ansehen &rarr;"
                $tbLead = "Ich habe Neuigkeiten zu teilen und wollte, dass Sie es zuerst von mir erfahren. Pause &amp; Move wurde f&uuml;r 10Best ausgew&auml;hlt &ndash; eine Schweizer Plattform, die nur die zehn besten Anbieter pro Branche und Kanton listet. Ich f&uuml;hle mich geehrt, einer der zehn in Basel zu sein."
                $tbH3_1 = "Warum mir das wichtig ist"
                $tbP1 = "Pl&auml;tze auf 10Best kann man nicht kaufen. Die Auswahl treffen Menschen: ein Telefongespr&auml;ch, ein pers&ouml;nliches Interview, ein strukturierter Fragebogen, unabh&auml;ngige Recherchen zu Kundenfeedback und ein Abschlussgespr&auml;ch mit ehrlicher R&uuml;ckmeldung. Was z&auml;hlt, sind Qualit&auml;t, Werte und Menschlichkeit, nicht Gr&ouml;sse oder Umsatz."
                $tbQuote = "Eine gute Behandlung ist eine, die den Klienten st&auml;rkt &mdash; und St&auml;rke entsteht durch Erfahrung und Bewusstsein."
                $tbP2 = "Das ist es, was mir am meisten bedeutet. Mir geht es nicht um die Zahl der Behandlungen, die ich gebe. Sondern darum, ob Sie die Praxis mit etwas Nachhaltigem verlassen."
                $tbH3_2 = "Danke"
                $tbP3 = "Diese Auszeichnung geh&ouml;rt allen, die mir ihren K&ouml;rper, ihre Fragen und ihre Zeit anvertraut haben. Ob Sie einmal wegen einer Schulter kamen, die nicht lockerlassen wollte, oder mich seit Monaten regelm&auml;ssig besuchen: Sie sind der Grund, warum diese Praxis das ist, was sie ist. Wenn Sie mir ein Feedback hinterlassen oder mich weiterempfohlen haben, danke ich Ihnen ganz besonders."
                $tbH3_3 = "Was gleich bleibt"
                $tbP4 = "An meiner Arbeitsweise &auml;ndert sich nichts. Jede Behandlung richtet sich weiterhin ganz nach dem, was Sie an diesem Tag mitbringen &ndash; sei es Klassische Massage, Shiatsu, Tuina, Connected Movement oder Qigong. Und wenn ich nicht das Richtige f&uuml;r Sie bin, sage ich Ihnen das nach wie vor ganz ehrlich."
                $tbCta = "Termin buchen"
                $tbSign = "In Dankbarkeit, Michael"
                $tbByline = "Von Michael Guralnik &middot; $($article.date) <b>$($article.readTime.ToUpper())</b>"
            }

            $articleDetailHtml = @"
    <section id="article-detail" class="section active">
      <div id="article-detail-custom" class="tenbest-layout" style="display:block;">
        <header class="tenbest-header">
          <div class="tenbest-wrap">
            <a class="tenbest-back" href="../../index.html#blog">$backBtnText</a>
            <span class="eyebrow">$tbEyebrow</span>
            <h1>$($article.title)</h1>
            <p class="tenbest-byline">$tbByline</p>
          </div>
        </header>

        <div class="tenbest-wrap">
          <section class="seal-card">
            <div class="seal-panel">
              <a class="seal" href="https://www.tenbest.ch/so-funktioniert-tenbest" target="_blank" rel="noopener" aria-label="10Best Schweiz">
                <img src="../../assets/10best-siegel.jpg" alt="10Best Schweiz Siegel 2026/2027, Pause &amp; Move" width="224" height="224">
              </a>
            </div>
            <div class="seal-text">
              <span class="eyebrow">$tbSealEyebrow</span>
              <h2>$tbSealTitle</h2>
              <p>$tbSealDesc</p>
              <a class="gold-link" href="https://www.tenbest.ch/so-funktioniert-tenbest" target="_blank" rel="noopener">$tbSealLink</a>
            </div>
          </section>

          <article class="tenbest-article">
            <p class="lead">$tbLead</p>

            <h3><span class="n">I</span>$tbH3_1</h3>
            <p>$tbP1</p>

            <blockquote>$tbQuote</blockquote>

            <p>$tbP2</p>

            <h3><span class="n">II</span>$tbH3_2</h3>
            <p>$tbP3</p>

            <h3><span class="n">III</span>$tbH3_3</h3>
            <p>$tbP4</p>
            <button class="cta" onclick="openModal();return false;">$tbCta</button>
            <p class="sign">$tbSign</p>

            <div class="share">
              <span>$shareTitle</span>
              <button onclick="shareArticle('x')">&#x1D54F;</button>
              <button onclick="shareArticle('facebook')">Facebook</button>
              <button onclick="shareArticle('linkedin')">LinkedIn</button>
              <button id="share-copy-btn" onclick="copyArticleLink()">$shareCopy</button>
            </div>
          </article>

          <section class="tenbest-sub">
            <h4>$subTitle</h4>
            <p>$subDesc</p>
            <form class="article-subscribe-form" onsubmit="submitSubscribeForm(event); return false;">
              <input type="text" id="sub-name" placeholder="$subNamePlaceholder" />
              <input type="email" id="sub-email" placeholder="$subPlaceholder" required />
              <input type="tel" id="sub-phone" placeholder="$subPhonePlaceholder" />
              <input type="text" name="email_address_check" value="" class="input--hidden" style="display:none !important;" tabindex="-1" autocomplete="off" />
              <button type="submit" class="btn-gold" id="sub-submit-btn">$subSubmit</button>
            </form>
            <p class="sub-success-msg" id="sub-success-msg" style="display:none; color: var(--gold); margin-top: 16px; font-weight: 500;"></p>
          </section>
        </div>

        <button class="float-cta" onclick="openModal();return false;">$tbCta</button>
      </div>
    </section>
"@
        } else {
            $articleDetailHtml = @"
    <section id="article-detail" class="section active">
      <div class="article-detail-hero">
        <div class="article-detail-hero-img" id="article-detail-img-container">
          <img src="$($article.image)" alt="$($article.title)"/>
        </div>
        <div class="article-detail-hero-content">
          <span class="blog-cat" id="article-detail-cat">$categoryName</span>
          <h1 class="display-xl" id="article-detail-title">$($article.title)</h1>
          <div class="article-detail-meta" id="article-detail-meta">
            <span class="article-author">$(if ($lang -eq "en") { "By" } else { "Von" }) $($article.author)</span> &middot; <span id="article-detail-date">$($article.date)</span> &middot; <span id="article-detail-read">$($article.readTime) $readTimeSuffix</span>
          </div>
        </div>
      </div>
      <div class="article-detail-body">
        <div class="article-detail-container">
          <div class="article-detail-main">
            <button class="back-to-blog" id="back-to-blog-btn" onclick="window.location.href='../../index.html#blog';return false;">$backBtnText</button>
            <div class="article-detail-text" id="article-detail-text">
$paragraphsHtml            </div>
            
            <!-- Share Block -->
            <div class="article-share-block">
              <span class="share-title" id="share-title-text">$shareTitle</span>
              <div class="share-buttons">
                <button class="share-btn share-x" onclick="shareArticle('x')">𝕏</button>
                <button class="share-btn share-fb" onclick="shareArticle('facebook')">Facebook</button>
                <button class="share-btn share-in" onclick="shareArticle('linkedin')">LinkedIn</button>
                <button class="share-btn share-copy" id="share-copy-btn" onclick="copyArticleLink()">$shareCopy</button>
              </div>
            </div>
            
            <!-- Subscribe Block -->
            <div class="article-subscribe-block">
              <h3 id="sub-title-text">$subTitle</h3>
              <p id="sub-desc-text">$subDesc</p>
              <form class="article-subscribe-form" onsubmit="submitSubscribeForm(event); return false;">
                <input type="text" id="sub-name" placeholder="$subNamePlaceholder" />
                <input type="email" id="sub-email" placeholder="$subPlaceholder" required />
                <input type="tel" id="sub-phone" placeholder="$subPhonePlaceholder" />
                <input type="text" name="email_address_check" value="" class="input--hidden" style="display:none !important;" tabindex="-1" autocomplete="off" />
                <button type="submit" class="btn-gold" id="sub-submit-btn">$subSubmit</button>
              </form>
              <p class="sub-success-msg" id="sub-success-msg" style="display:none; color: var(--gold); margin-top: 16px; font-weight: 500;"></p>
            </div>
          </div>
          
          <aside class="article-detail-sidebar">
            <!-- Categories Sidebar Section -->
            <div class="sidebar-widget">
              <h3 id="sidebar-categories-title">$sidebarCategoriesTitle</h3>
              <ul class="sidebar-categories-list" id="sidebar-categories">
$sidebarCategoriesHtml              </ul>
            </div>
            
            <!-- Recent Posts Sidebar Section -->
            <div class="sidebar-widget">
              <h3 id="sidebar-recent-title">$sidebarRecentTitle</h3>
              <div class="sidebar-recent-list" id="sidebar-recent">
$sidebarRecentHtml              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
"@
        }

        # Make the page HTML
        $pageHtml = $translatedLayout
        
        # 1. Replace <main> container content with our pre-rendered article section
        $pageHtml = $pageHtml -replace '(?s)<main class="page-body">.*?</main>', "<main class=`"page-body`">`n$articleDetailHtml`n</main>"
        
        # 2. Adjust relative asset URLs (move up 2 directory levels since file is in /journal/en/ or /journal/de/)
        $pageHtml = $pageHtml -replace 'href="index\.css[^"]*"', 'href="../../index.css?v=2.2"'
        $pageHtml = $pageHtml -replace 'href="favicon.png\?v=3"', 'href="../../favicon.png?v=3"'
        $pageHtml = $pageHtml -replace 'href="favicon.ico"', 'href="../../favicon.ico"'
        $pageHtml = $pageHtml -replace 'src="assets/', 'src="../../assets/'
        
        # 3. Replace dynamic nav-links that navigate inside SPA to point back to root index.html hashes
        $pageHtml = $pageHtml -replace 'href="#" onclick="showSection\(''home''\);return false;"', 'href="../../index.html#home"'
        $pageHtml = $pageHtml -replace 'href="#" onclick="showSection\(''about''\);return false;"', 'href="../../index.html#about"'
        $pageHtml = $pageHtml -replace 'href="#" onclick="showSection\(''services''\);return false;"', 'href="../../index.html#services"'
        $pageHtml = $pageHtml -replace 'href="#" onclick="showSection\(''modalities''\);return false;"', 'href="../../index.html#modalities"'
        $pageHtml = $pageHtml -replace 'href="#" onclick="clickJournalLink\(\);return false;"', 'href="../../index.html#blog"'
        $pageHtml = $pageHtml -replace 'href="#" onclick="showSection\(''contact''\);return false;"', 'href="../../index.html#contact"'
        
        $pageHtml = $pageHtml -replace 'onclick="showSection\(''home''\)"', 'onclick="window.location.href=''../../index.html#home''"'
        $pageHtml = $pageHtml -replace 'onclick="closeDrawer\(\);openModal\(\);return false;"', 'onclick="closeDrawer();openModal();return false;"'
        
        # 4. Replace language toggles: DE / EN point to each other's static article version directly
        $otherLang = if ($lang -eq "en") { "de" } else { "en" }
        $pageHtml = $pageHtml -replace '<button class="nav-lang-toggle" onclick="toggleLanguage\(\)">[A-Z]{2}</button>', "<a class=`"nav-lang-toggle`" href=`"../$otherLang/$($article.id)`" style=`"text-decoration:none; display:flex; align-items:center;`">$($otherLang.ToUpper())</a>"
        
        # 5. Inject SEO Head elements (title, meta description, keywords, OpenGraph, hreflang)
        $seoTitle = "$($article.title) - Pause & Move Journal"
        $seoDesc = $article.abstract
        $seoKeywords = ($article.keywords -join ", ")
        $articleUrl = "https://pauseandmove.ch/journal/$lang/$($article.id)"
        $altArticleUrl = "https://pauseandmove.ch/journal/$otherLang/$($article.id)"
        $ogImageUrl = if ($article.image -match '^https?://') { $article.image } else { "https://pauseandmove.ch/" + $article.image.TrimStart('/') }
        
        $seoHeadTags = @"
  <title>$seoTitle</title>
  <meta name="description" content="$seoDesc" />
  <meta name="keywords" content="$seoKeywords" />
  <meta name="author" content="Michael Guralnik" />
  <link rel="canonical" href="$articleUrl" />
  <link rel="alternate" hreflang="$lang" href="$articleUrl" />
  <link rel="alternate" hreflang="$otherLang" href="$altArticleUrl" />
  
  <!-- OpenGraph Metadata for Rich Sharing Previews -->
  <meta property="og:title" content="$seoTitle" />
  <meta property="og:description" content="$seoDesc" />
  <meta property="og:image" content="$ogImageUrl" />
  <meta property="og:url" content="$articleUrl" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Pause & Move Basel" />
  <meta name="twitter:card" content="summary_large_image" />
"@
        
        # Replace template titles, descriptions, keywords, canonical, alternate links, and OpenGraph/Twitter tags
        $pageHtml = $pageHtml -replace '(?s)<title>.*?</title>', ""
        $pageHtml = $pageHtml -replace '<meta name="description"[^>]*>', ""
        $pageHtml = $pageHtml -replace '<meta name="keywords"[^>]*>', ""
        $pageHtml = $pageHtml -replace '<link rel="canonical"[^>]*>', ""
        $pageHtml = $pageHtml -replace '<link rel="alternate"[^>]*>', ""
        $pageHtml = $pageHtml -replace '<meta property="og:[^"]*"[^>]*>', ""
        $pageHtml = $pageHtml -replace '<meta name="twitter:[^"]*"[^>]*>', ""
        
        # Inject our comprehensive SEO head tags right after <head>
        $pageHtml = $pageHtml -replace '<head>', "<head>`n$seoHeadTags"
        
        # 6. Adjust language attributes and OneDoc widget for German articles
        if ($lang -eq "de") {
            $pageHtml = $pageHtml -replace '<html lang="en">', '<html lang="de">'
            $pageHtml = $pageHtml -replace 'data-src="https://www.onedoc.ch/en/widget/', 'data-src="https://www.onedoc.ch/de/widget/'
        }
        
        # 7. Replace client-side routing script index.js with static interactive scripts
        $onedocWidgetUrl = if ($lang -eq "de") { "https://www.onedoc.ch/de/widget/ac82c9936ce134b4d7a318a8eba07dc0eeff662478ef3eb0077fbb97c2efde30" } else { "https://www.onedoc.ch/en/widget/ac82c9936ce134b4d7a318a8eba07dc0eeff662478ef3eb0077fbb97c2efde30" }
        $inlineScripts = @"
<script>
  // Mobile drawer toggles
  function toggleDrawer() { document.getElementById('nav-drawer').classList.toggle('open'); }
  function closeDrawer() { document.getElementById('nav-drawer').classList.remove('open'); }
  
  // Booking modal toggles
  function openModal() {
    var overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    var iframe = overlay.querySelector('iframe.od-widget');
    if (iframe) {
      var desiredSrc = "$onedocWidgetUrl";
      if (!iframe.src || iframe.src === 'about:blank' || iframe.src === window.location.href) {
        iframe.src = desiredSrc;
      }
    }
  }
  function closeModal() {
    var overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  var overlayEl = document.getElementById('modal-overlay');
  if (overlayEl) {
    overlayEl.addEventListener('click', function(e){ if(e.target===this) closeModal(); });
  }
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); closeDrawer(); } });
  
  // Social sharing helpers
  function shareArticle(platform) {
    const shareUrl = window.location.href;
    const shareText = document.getElementById('article-detail-title').textContent;
    let url = '';
    if (platform === 'x') {
      url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl);
    } else if (platform === 'facebook') {
      url = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl);
    } else if (platform === 'linkedin') {
      url = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl);
    }
    if (url) window.open(url, '_blank', 'width=600,height=400,resizable=yes,scrollbars=yes');
  }
  
  // Copy sharing link helper
  function copyArticleLink() {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      const copyBtn = document.getElementById('share-copy-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = document.documentElement.lang === 'en' ? 'Copied!' : 'Kopiert!';
        copyBtn.style.background = 'var(--gold)';
        copyBtn.style.color = 'var(--black)';
        copyBtn.style.borderColor = 'var(--gold)';
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = '';
          copyBtn.style.color = '';
          copyBtn.style.borderColor = '';
        }, 2000);
      }
    });
  }
  
  // Form submissions (Dynamic AJAX endpoints)
  function submitSubscribeForm(event) {
    event.preventDefault();
    const nameInput = document.getElementById('sub-name');
    const emailInput = document.getElementById('sub-email');
    const phoneInput = document.getElementById('sub-phone');
    const submitBtn = document.getElementById('sub-submit-btn');
    const successMsg = document.getElementById('sub-success-msg');
    if (!emailInput || !submitBtn || !successMsg) return;
    const email = emailInput.value.trim();
    if (!email) return;
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    const lang = document.documentElement.lang || 'en';
    submitBtn.textContent = lang === 'en' ? 'Subscribing...' : 'Abonnieren...';
    
    const formData = new FormData();
    formData.append('EMAIL', email);
    formData.append('email_address_check', '');
    formData.append('locale', lang);
    
    if (nameInput && nameInput.value.trim()) {
      const fullName = nameInput.value.trim();
      formData.append('LASTNAME', fullName);
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length > 1) {
        formData.append('FIRSTNAME', nameParts[0]);
      } else {
        formData.append('FIRSTNAME', fullName);
      }
    }

    if (phoneInput && phoneInput.value.trim()) {
      let rawPhone = phoneInput.value.trim().replace(/[\s\-\(\)\.]/g, '');
      if (rawPhone.startsWith('+')) {
        rawPhone = rawPhone.substring(1);
      } else if (rawPhone.startsWith('00')) {
        rawPhone = rawPhone.substring(2);
      } else if (rawPhone.startsWith('0')) {
        rawPhone = '41' + rawPhone.substring(1);
      }
      formData.append('SMS', rawPhone);
      formData.append('SMS__COUNTRY_CODE', '+41');
    }

    fetch('https://ea0ee002.sibforms.com/serve/MUIFAHJandeaKxhFoJs2weLG--8wPH11W86bv-eXXsv4mJC_3nbpxCqDRFjKT0jagjcUwGv3KM0gl9a5ifXl0jgDOSjwRM02NUQVVm77kynF4gbhBVVyB0c8rc1VZAsAgUUfMET1lDTF0DLIaGAADKopqloNnFHu7bfR3g1CdsVz6w_matjJ7-y7WtHBKOO1umwigntEW-5-2VNgbA==', {
      method: 'POST',
      body: formData,
      mode: 'cors'
    })
    .then(response => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      if (nameInput) nameInput.value = '';
      emailInput.value = '';
      if (phoneInput) phoneInput.value = '';
      successMsg.style.display = 'block';
      successMsg.style.color = 'var(--gold)';
      successMsg.textContent = lang === 'en'
        ? 'Thank you! You have successfully subscribed to our newsletter.'
        : 'Vielen Dank! Sie haben unseren Newsletter erfolgreich abonniert.';
    })
    .catch(err => {
      console.error('Brevo subscription error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      successMsg.style.display = 'block';
      successMsg.style.color = '#ff6b6b';
      successMsg.textContent = lang === 'en'
        ? 'Something went wrong. Please try again.'
        : 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.';
    });
  }
  
  function submitBookingForm(event) {
    if (event) event.preventDefault();
    closeModal();
  }
</script>
"@
        
        $pageHtml = $pageHtml -replace '<script src="index\.js[^"]*"></script>', $inlineScripts
        
        # Write pre-rendered file to disk (forcing UTF-8 encoding)
        $outPath = if ($lang -eq "en") { Join-Path $enDir "$($article.id).html" } else { Join-Path $deDir "$($article.id).html" }
        [System.IO.File]::WriteAllText($outPath, $pageHtml, [System.Text.Encoding]::UTF8)

        # Legacy redirect for fixed typo URL
        if ($article.id -eq "massage-oils-and-other-lubricants") {
            $legacyOutPath = if ($lang -eq "en") { Join-Path $enDir "massage-oils-and-other-lubricats.html" } else { Join-Path $deDir "massage-oils-and-other-lubricats.html" }
            $cleanTargetUrl = "https://pauseandmove.ch/journal/$lang/massage-oils-and-other-lubricants"
            $legacyHtml = @"
<!DOCTYPE html>
<html lang="$lang">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="refresh" content="0; url=$cleanTargetUrl" />
  <link rel="canonical" href="$cleanTargetUrl" />
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="$cleanTargetUrl">$cleanTargetUrl</a>...</p>
</body>
</html>
"@
            [System.IO.File]::WriteAllText($legacyOutPath, $legacyHtml, [System.Text.Encoding]::UTF8)
        }
    }
}

# Clean up orphaned journal HTML files if not in draft preview mode
if (-not $IncludeDrafts) {
    Write-Host "Cleaning up orphaned journal HTML files..." -ForegroundColor Cyan
    $validIds = @($blogData.en.articles | Where-Object { $null -eq $_.published -or $_.published -ne $false } | ForEach-Object { $_.id }) + @("massage-oils-and-other-lubricats")
    if (Test-Path $enDir) {
        Get-ChildItem -Path $enDir -Filter "*.html" | ForEach-Object {
            if ($validIds -notcontains $_.BaseName) {
                Write-Host "Removing orphaned file: $($_.FullName)" -ForegroundColor Yellow
                Remove-Item $_.FullName -Force
            }
        }
    }
    if (Test-Path $deDir) {
        Get-ChildItem -Path $deDir -Filter "*.html" | ForEach-Object {
            if ($validIds -notcontains $_.BaseName) {
                Write-Host "Removing orphaned file: $($_.FullName)" -ForegroundColor Yellow
                Remove-Item $_.FullName -Force
            }
        }
    }
    if (Test-Path $legacyDeDir) {
        Get-ChildItem -Path $legacyDeDir -Filter "*.html" | Where-Object { $_.BaseName -ne "index" } | ForEach-Object {
            Write-Host "Removing obsolete legacy article file: $($_.FullName)" -ForegroundColor Yellow
            Remove-Item $_.FullName -Force
        }
    }
}

# 7. Generate sitemap.xml at root
Write-Host "Generating sitemap.xml at root..." -ForegroundColor Cyan
$sitemapPath = Join-Path $rootDir "sitemap.xml"

# Start XML structure
$sitemapXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://pauseandmove.ch/</loc>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://pauseandmove.ch/" />
    <xhtml:link rel="alternate" hreflang="de" href="https://pauseandmove.ch/de/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://pauseandmove.ch/" />
  </url>
  <url>
    <loc>https://pauseandmove.ch/de/</loc>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://pauseandmove.ch/" />
    <xhtml:link rel="alternate" hreflang="de" href="https://pauseandmove.ch/de/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://pauseandmove.ch/" />
  </url>
  <url>
    <loc>https://pauseandmove.ch/pause-and-move-classic-massage</loc>
    <priority>0.8</priority>
  </url>
"@

# Loop over articles
foreach ($article in ($blogData.en.articles | Where-Object { $null -eq $_.published -or $_.published -ne $false })) {
    $articleId = $article.id
    if ($articleId -eq "massage-oils-and-other-lubricats") {
        $articleId = "massage-oils-and-other-lubricants"
    }
    $enUrl = "https://pauseandmove.ch/journal/en/$articleId"
    $deUrl = "https://pauseandmove.ch/journal/de/$articleId"
    
    $sitemapXml += "`n  <url>"
    $sitemapXml += "`n    <loc>$enUrl</loc>"
    $sitemapXml += "`n    <priority>0.6</priority>"
    $sitemapXml += "`n    <xhtml:link rel=`"alternate`" hreflang=`"en`" href=`"$enUrl`" />"
    $sitemapXml += "`n    <xhtml:link rel=`"alternate`" hreflang=`"de`" href=`"$deUrl`" />"
    $sitemapXml += "`n  </url>"
    
    $sitemapXml += "`n  <url>"
    $sitemapXml += "`n    <loc>$deUrl</loc>"
    $sitemapXml += "`n    <priority>0.6</priority>"
    $sitemapXml += "`n    <xhtml:link rel=`"alternate`" hreflang=`"en`" href=`"$enUrl`" />"
    $sitemapXml += "`n    <xhtml:link rel=`"alternate`" hreflang=`"de`" href=`"$deUrl`" />"
    $sitemapXml += "`n  </url>"
}

$sitemapXml += "`n</urlset>"

# Write sitemap.xml to disk
[System.IO.File]::WriteAllText($sitemapPath, $sitemapXml, [System.Text.Encoding]::UTF8)
Write-Host "sitemap.xml generated successfully!" -ForegroundColor Green

Write-Host "Pre-rendering completed successfully!" -ForegroundColor Green
