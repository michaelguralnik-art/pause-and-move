# generate_blog.ps1
# Automates the pre-rendering of blog posts for Pause & Move website (Bilingual & SEO optimized)

$rootDir = $PSScriptRoot
$blogJsonPath = Join-Path $rootDir "blog.json"
$contentJsonPath = Join-Path $rootDir "content.json"
$indexHtmlPath = Join-Path $rootDir "index.html"
$journalDir = Join-Path $rootDir "journal"

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
    
    $articles = $langBlog.articles | Where-Object { $null -eq $_.published -or $_.published -ne $false }
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
            $subPlaceholder = "Your email address"
            $subSubmit = "Subscribe"
            $sidebarCategoriesTitle = "Categories"
            $sidebarRecentTitle = "Recent Posts"
            $backBtnText = "&larr; Back to Journal"
            $readTimeSuffix = "read"
        } else {
            $shareTitle = "Diesen Artikel teilen:"
            $shareCopy = "Link kopieren"
            $subTitle = "Newsletter abonnieren"
            $subDesc = "Erhalten Sie wertvolle Einblicke in Gesundheit, Wohlbefinden und Atemübungen direkt in Ihr Postfach."
            $subPlaceholder = "Ihre E-Mail-Adresse"
            $subSubmit = "Abonnieren"
            $sidebarCategoriesTitle = "Kategorien"
            $sidebarRecentTitle = "Neueste Beiträge"
            $backBtnText = "&larr; Zurück zum Journal"
            $readTimeSuffix = "Lesezeit"
        }
        
        # Resolve category name(s) (supports multiple categories)
        $categoryName = ""
        if ($null -ne $article.categoryIds -and $article.categoryIds.Count -gt 0) {
            $catNames = @()
            foreach ($catId in $article.categoryIds) {
                $name = $categories.$catId
                if ($null -eq $name) { $name = $catId }
                $catNames += $name
            }
            $categoryName = $catNames -join " $([char]0xB7) "
        } else {
            $categoryName = $categories.$($article.categoryId)
            if ($null -eq $categoryName) { $categoryName = $article.categoryId }
        }
        
        # Calculate Sidebar Categories HTML
        $sidebarCategoriesHtml = ""
        foreach ($catKey in $categories.psobject.Properties.Name) {
            if ($catKey -ne "all") {
                $count = ($articles | Where-Object {
                    if ($null -ne $_.categoryIds -and $_.categoryIds.Count -gt 0) {
                        $_.categoryIds -contains $catKey
                    } else {
                        $_.categoryId -eq $catKey
                    }
                }).Count
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
            $sidebarRecentHtml += "          <a href=`"$($rec.id).html`" class=`"sidebar-recent-item`" style=`"text-decoration: none; color: inherit; display: flex;`">`n"
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
                <input type="email" id="sub-email" placeholder="$subPlaceholder" required />
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

        # Make the page HTML
        $pageHtml = $translatedLayout
        
        # 1. Replace <main> container content with our pre-rendered article section
        $pageHtml = $pageHtml -replace '(?s)<main class="page-body">.*?</main>', "<main class=`"page-body`">`n$articleDetailHtml`n</main>"
        
        # 2. Adjust relative asset URLs (move up 2 directory levels since file is in /journal/en/ or /journal/de/)
        $pageHtml = $pageHtml -replace 'href="index.css"', 'href="../../index.css"'
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
        $pageHtml = $pageHtml -replace '<button class="nav-lang-toggle" onclick="toggleLanguage\(\)">[A-Z]{2}</button>', "<a class=`"nav-lang-toggle`" href=`"../$otherLang/$($article.id).html`" style=`"text-decoration:none; display:flex; align-items:center;`">$($otherLang.ToUpper())</a>"
        
        # 5. Inject SEO Head elements (title, meta description, keywords, OpenGraph, hreflang)
        $seoTitle = "$($article.title) - Pause & Move Journal"
        $seoDesc = $article.abstract
        $seoKeywords = ($article.keywords -join ", ")
        $articleUrl = "https://pauseandmove.ch/journal/$lang/$($article.id).html"
        $altArticleUrl = "https://pauseandmove.ch/journal/$otherLang/$($article.id).html"
        
        $seoHeadTags = @"
  <title>$seoTitle</title>
  <meta name="description" content="$seoDesc" />
  <meta name="keywords" content="$seoKeywords" />
  <link rel="canonical" href="$articleUrl" />
  <link rel="alternate" hreflang="$lang" href="$articleUrl" />
  <link rel="alternate" hreflang="$otherLang" href="$altArticleUrl" />
  
  <!-- OpenGraph Metadata for Rich Sharing Previews -->
  <meta property="og:title" content="$seoTitle" />
  <meta property="og:description" content="$seoDesc" />
  <meta property="og:image" content="$($article.image)" />
  <meta property="og:url" content="$articleUrl" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Pause & Move Basel" />
  <meta name="twitter:card" content="summary_large_image" />
"@
        
        # Replace template titles, descriptions and keywords
        $pageHtml = $pageHtml -replace '(?s)<title>.*?</title>', ""
        $pageHtml = $pageHtml -replace '<meta name="description"[^>]*>', ""
        $pageHtml = $pageHtml -replace '<meta name="keywords"[^>]*>', ""
        
        # Inject our comprehensive SEO head tags right after <head>
        $pageHtml = $pageHtml -replace '<head>', "<head>`n$seoHeadTags"
        
        # 6. Replace client-side routing script index.js with static interactive scripts
        $inlineScripts = @"
<script>
  // Mobile drawer toggles
  function toggleDrawer() { document.getElementById('nav-drawer').classList.toggle('open'); }
  function closeDrawer() { document.getElementById('nav-drawer').classList.remove('open'); }
  
  // Booking modal toggles
  function openModal() { document.getElementById('modal-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
  function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); document.body.style.overflow=''; }
  document.getElementById('modal-overlay').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
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
    const emailInput = document.getElementById('sub-email');
    const submitBtn = document.getElementById('sub-submit-btn');
    const successMsg = document.getElementById('sub-success-msg');
    if (!emailInput || !submitBtn || !successMsg) return;
    const email = emailInput.value.trim();
    if (!email) return;
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    const lang = document.documentElement.lang;
    submitBtn.textContent = lang === 'en' ? 'Subscribing...' : 'Abonnieren...';
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      emailInput.value = '';
      successMsg.style.display = 'block';
      successMsg.textContent = lang === 'en'
        ? 'Thank you! You have successfully subscribed to our newsletter.'
        : 'Vielen Dank! Sie haben unseren Newsletter erfolgreich abonniert.';
    }, 1000);
  }
  
  function submitBookingForm(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('bm-submit');
    const originalText = submitBtn.textContent;
    const firstName = document.getElementById('bm-first-name').value.trim();
    const lastName = document.getElementById('bm-last-name').value.trim();
    const email = document.getElementById('bm-email').value.trim();
    const therapy = document.getElementById('bm-therapy').value;
    const notes = document.getElementById('bm-notes').value.trim();
    const clientName = firstName + " " + lastName;
    const lang = document.documentElement.lang;
    submitBtn.disabled = true;
    submitBtn.textContent = lang === 'en' ? 'Sending...' : 'Senden...';
    fetch("https://formsubmit.co/ajax/hello@pauseandmove.ch", {
      method: "POST",
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: "Booking Request " + clientName,
        "Name": clientName,
        "Email": email,
        "Therapy": therapy,
        "Notes": notes,
        _captcha: "false"
      })
    })
    .then(response => {
      if (response.ok) {
        submitBtn.textContent = lang === 'en' ? 'Sent successfully!' : 'Erfolgreich gesendet!';
        document.getElementById('booking-form').reset();
        setTimeout(() => {
          closeModal();
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }, 1500);
      } else { throw new Error(); }
    })
    .catch(() => {
      submitBtn.textContent = lang === 'en' ? 'Error. Try again.' : 'Fehler. Erneut versuchen.';
      submitBtn.disabled = false;
      setTimeout(() => { submitBtn.textContent = originalText; }, 3000);
    });
  }
</script>
"@
        
        $pageHtml = $pageHtml -replace '<script src="index.js"></script>', $inlineScripts
        
        # Write pre-rendered file to disk (forcing UTF-8 encoding)
        $outPath = if ($lang -eq "en") { Join-Path $enDir "$($article.id).html" } else { Join-Path $deDir "$($article.id).html" }
        [System.IO.File]::WriteAllText($outPath, $pageHtml, [System.Text.Encoding]::UTF8)
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
    <xhtml:link rel="alternate" hreflang="de" href="https://pauseandmove.ch/" />
  </url>
  <url>
    <loc>https://pauseandmove.ch/pause-and-move-classic-massage.html</loc>
    <priority>0.8</priority>
  </url>
"@

# Loop over articles
foreach ($article in $blogData.en.articles) {
    if ($null -ne $article.published -and $article.published -eq $false) { continue }
    $articleId = $article.id
    $enUrl = "https://pauseandmove.ch/journal/en/$articleId.html"
    $deUrl = "https://pauseandmove.ch/journal/de/$articleId.html"
    
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
