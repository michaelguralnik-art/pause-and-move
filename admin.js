// --- AntiGravity CMS - Overhauled WYSIWYG & Copywriting AI Engine ---

let blogData = null;
let currentArticleId = null;
let activeCategoryFilter = 'all';
let searchQuery = '';

// Undo/Redo History Stacks
let undoStack = [];
let redoStack = [];

// Translation & AI State
let englishIsModifiedSinceLastTranslation = false;
let aiTargetLang = 'en'; // 'en' or 'de'
let aiSuggestedText = '';

// Selection Caching State
let cachedSelectionRange = null;
let cachedSelectionText = '';
let cachedSelectionPane = null; // 'en' or 'de'

// DOM Element Pointers
const elSearchInput = document.getElementById('search-articles');
const elCategoryFilters = document.getElementById('category-filter-list');
const elArticleList = document.getElementById('article-list-container');
const elEmptyState = document.getElementById('empty-state');
const elEditorContent = document.getElementById('editor-content');

// Form Metadata Controls
const elTitleEn = document.getElementById('edit-title-en');
const elTitleDe = document.getElementById('edit-title-de');
const elDate = document.getElementById('edit-date');
const elReadTime = document.getElementById('edit-read-time');
const elAuthor = document.getElementById('edit-author');
const elImage = document.getElementById('edit-image');
const elKeywordsEn = document.getElementById('edit-keywords-en');
const elKeywordsDe = document.getElementById('edit-keywords-de');
const elAbstractEn = document.getElementById('edit-abstract-en');
const elAbstractDe = document.getElementById('edit-abstract-de');
const elCoverPreview = document.getElementById('cover-image-preview');
const elCategoriesContainer = document.getElementById('categories-checkboxes');

// WYSIWYG Editor Panes
const bodyTextEn = document.getElementById('body-text-en');
const bodyTextDe = document.getElementById('body-text-de');
const charCountEnLabel = document.getElementById('body-char-en');
const charCountDeLabel = document.getElementById('body-char-de');
const btnTranslate = document.getElementById('btn-translate');
const elBtnTranslateTitle = document.getElementById('btn-translate-title');
const elBtnTranslateKeywords = document.getElementById('btn-translate-keywords');
const elBtnTranslateAbstract = document.getElementById('btn-translate-abstract');
const elBtnTogglePublish = document.getElementById('btn-toggle-publish');

// Global Actions Buttons
const elBtnUndo = document.getElementById('btn-undo');
const elBtnRedo = document.getElementById('btn-redo');
const elBtnSave = document.getElementById('btn-save');
const elBtnPublish = document.getElementById('btn-publish');
const elBtnReloadImage = document.getElementById('btn-reload-image');
const elBtnImageAi = document.getElementById('btn-image-ai');
const elBtnNewArticle = document.getElementById('btn-new-article');
const elBtnPreview = document.getElementById('btn-preview');
const elPreviewModal = document.getElementById('preview-modal');
const elBtnPreviewClose = document.getElementById('btn-preview-close');
const elBtnPreviewCancel = document.getElementById('btn-preview-cancel');
const elBtnPreviewEn = document.getElementById('btn-preview-en');
const elBtnPreviewDe = document.getElementById('btn-preview-de');

// AI Assist Modal Pointers
const elAiModal = document.getElementById('ai-modal');
const elBtnAiClose = document.getElementById('btn-ai-close');
const elBtnAiCancel = document.getElementById('btn-ai-cancel');
const elBtnAiApply = document.getElementById('btn-ai-apply');
const elBtnAiGenerate = document.getElementById('btn-ai-generate');
const elAiTone = document.getElementById('ai-tone');
const elAiPrompt = document.getElementById('ai-prompt');
const elAiOriginalText = document.getElementById('ai-original-text');
const elAiSuggestionText = document.getElementById('ai-suggestion-text');
const elBtnAiAssistEn = document.getElementById('btn-ai-assist-en');
const elBtnAiAssistDe = document.getElementById('btn-ai-assist-de');

// Confirm Save & Translate Prompts
const elConfirmModal = document.getElementById('confirm-save-modal');
const elBtnConfirmClose = document.getElementById('btn-confirm-close');
const elBtnConfirmCancel = document.getElementById('btn-confirm-cancel');
const elBtnConfirmNo = document.getElementById('btn-confirm-no');
const elBtnConfirmYes = document.getElementById('btn-confirm-yes');

// Publish Modal Pointers
const elPublishModal = document.getElementById('publish-modal');
const elBtnPublishClose = document.getElementById('btn-publish-close');
const elBtnPublishCancel = document.getElementById('btn-publish-cancel');
const elBtnPublishConfirm = document.getElementById('btn-publish-confirm');
const elPublishVersion = document.getElementById('publish-version');
const elPublishComments = document.getElementById('publish-comments');

// Loading Modal
const elLoadingModal = document.getElementById('loading-modal');
const elLoadingProgressBar = document.getElementById('loading-progress-bar');
const elLoadingModalMessage = document.getElementById('loading-modal-message');
const elLoadingProgressContainer = document.getElementById('loading-progress-container');

// Toast Notification Container
const elToastContainer = document.getElementById('toast-container');

// Initialize Lucide Icons
function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Deep clone utility to prevent reference mutations
function cloneState(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Show toast message
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  elToastContainer.appendChild(toast);
  initIcons();
  
  // Animate show
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Load blog data
async function loadBlogData() {
  try {
    const response = await fetch('/api/blog');
    if (!response.ok) throw new Error('Failed to fetch blog JSON');
    blogData = await response.json();
    
    // Clear history stacks
    undoStack = [];
    redoStack = [];
    updateHistoryButtons();
    
    renderCategoryFilters();
    renderSidebar();
    
    // Pick first article if available
    const articles = blogData.en.articles;
    if (articles.length > 0) {
      selectArticle(articles[0].id);
    }
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
  }
}

// Update Undo/Redo button states
function updateHistoryButtons() {
  elBtnUndo.disabled = undoStack.length === 0;
  elBtnRedo.disabled = redoStack.length === 0;
}

// Push to Undo history
function saveHistoryState() {
  undoStack.push(cloneState(blogData));
  redoStack = []; // Clear redo stack on new action
  updateHistoryButtons();
}

// Undo action
function triggerUndo() {
  if (undoStack.length === 0) return;
  redoStack.push(cloneState(blogData));
  blogData = undoStack.pop();
  updateHistoryButtons();
  
  // Re-sync UI
  renderSidebar();
  if (currentArticleId) {
    loadArticleForm(currentArticleId);
  }
  showToast('Undo performed', 'info');
}

// Redo action
function triggerRedo() {
  if (redoStack.length === 0) return;
  undoStack.push(cloneState(blogData));
  blogData = redoStack.pop();
  updateHistoryButtons();
  
  // Re-sync UI
  renderSidebar();
  if (currentArticleId) {
    loadArticleForm(currentArticleId);
  }
  showToast('Redo performed', 'info');
}

// Render Sidebar category filter lists
function renderCategoryFilters() {
  const categories = blogData.en.categories;
  elCategoryFilters.innerHTML = '';
  
  Object.keys(categories).forEach(key => {
    const pill = document.createElement('div');
    pill.className = `category-pill ${activeCategoryFilter === key ? 'active' : ''}`;
    pill.textContent = categories[key];
    pill.addEventListener('click', () => {
      activeCategoryFilter = key;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderSidebar();
    });
    elCategoryFilters.appendChild(pill);
  });
}

// Render Sidebar article lists
function renderSidebar() {
  elArticleList.innerHTML = '';
  
  const articles = blogData.en.articles;
  const filtered = articles.filter(art => {
    // Match search query
    const matchSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        art.abstract.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Match category
    const catIds = art.categoryIds || (art.categoryId ? [art.categoryId] : []);
    const matchCategory = activeCategoryFilter === 'all' || catIds.includes(activeCategoryFilter);
    
    return matchSearch && matchCategory;
  });
  
  if (filtered.length === 0) {
    elArticleList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">No articles found</div>';
    return;
  }
  
  filtered.forEach(art => {
    const item = document.createElement('div');
    item.className = `article-item ${currentArticleId === art.id ? 'active' : ''}`;
    
    const catIds = art.categoryIds || (art.categoryId ? [art.categoryId] : []);
    const categoriesText = catIds.map(id => blogData.en.categories[id] || id).join(', ');
    
    const isPublished = art.published !== false;
    const statusHtml = isPublished 
      ? `<span class="badge badge-success" style="padding: 2px 5px; font-size: 10px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check-circle" style="width: 10px; height: 10px;"></i>Pub</span>`
      : `<span class="badge badge-warning" style="padding: 2px 5px; font-size: 10px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="edit-3" style="width: 10px; height: 10px;"></i>Draft</span>`;

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <h4 style="margin: 0; flex: 1;">${art.title}</h4>
        ${statusHtml}
      </div>
      <div class="article-item-meta" style="margin-top: 4px;">
        <span>${categoriesText}</span>
        <span>${art.date}</span>
      </div>
    `;
    
    item.addEventListener('click', () => {
      selectArticle(art.id);
    });
    
    elArticleList.appendChild(item);
  });
  
  // Initialize Lucide icons on dynamic status badges
  initIcons();
}

// Load article details into the form editor
function selectArticle(articleId) {
  currentArticleId = articleId;
  
  // Highlight in sidebar
  document.querySelectorAll('.article-item').forEach(item => item.classList.remove('active'));
  renderSidebar();
  
  elEmptyState.style.display = 'none';
  elEditorContent.style.display = 'block';
  
  loadArticleForm(articleId);
}

function handleNewArticleClick() {
  const title = prompt("Enter a title for the new journal post:");
  if (title === null) return;
  
  const trimmedTitle = title.trim();
  if (trimmedTitle === "") {
    showToast("Article title cannot be empty.", "warning");
    return;
  }
  
  const newId = slugify(trimmedTitle) || 'new-post';
  let uniqueId = newId;
  let counter = 1;
  while (blogData.en.articles.some(a => a.id === uniqueId)) {
    uniqueId = `${newId}-${counter}`;
    counter++;
  }
  
  const dateOptionsEn = { month: 'long', year: 'numeric' };
  const dateStrEn = new Date().toLocaleDateString('en-US', dateOptionsEn);
  
  const dateOptionsDe = { month: 'long', year: 'numeric' };
  const dateStrDe = new Date().toLocaleDateString('de-DE', dateOptionsDe);
  
  const newArtEn = {
    id: uniqueId,
    categoryId: "health",
    categoryIds: ["health"],
    title: trimmedTitle,
    date: dateStrEn,
    readTime: "5 min",
    author: "Michael Guralnik",
    abstract: "Abstract of the new somatic journal post.",
    image: "",
    keywords: [],
    content: ["Start writing your new post here..."],
    published: false
  };
  
  const newArtDe = {
    id: uniqueId,
    categoryId: "health",
    categoryIds: ["health"],
    title: trimmedTitle + " (DE)",
    date: dateStrDe,
    readTime: "5 Min.",
    author: "Michael Guralnik",
    abstract: "Zusammenfassung des neuen somatischen Journal-Posts.",
    image: "",
    keywords: [],
    content: ["Beginnen Sie hier mit dem Schreiben..."],
    published: false
  };
  
  saveHistoryState();
  blogData.en.articles.push(newArtEn);
  blogData.de.articles.push(newArtDe);
  
  renderSidebar();
  selectArticle(uniqueId);
  showToast("New post created! Click Save when done.", "success");
}

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Populate inputs from the active article
function loadArticleForm(articleId) {
  const artEn = blogData.en.articles.find(a => a.id === articleId);
  const artDe = blogData.de.articles.find(a => a.id === articleId);
  
  if (!artEn || !artDe) return;
  
  document.getElementById('meta-article-id').textContent = `ID: ${artEn.id}`;
  
  elTitleEn.value = artEn.title;
  elTitleDe.value = artDe.title;
  elDate.value = artEn.date;
  elReadTime.value = artEn.readTime;
  elAuthor.value = artEn.author || 'Michael Guralnik';
  elImage.value = artEn.image || '';
  elKeywordsEn.value = (artEn.keywords || []).join(', ');
  elKeywordsDe.value = (artDe.keywords || []).join(', ');
  elAbstractEn.value = artEn.abstract;
  elAbstractDe.value = artDe.abstract;
  
  // Set publication status UI
  const isPublished = artEn.published !== false;
  updateArticleStatusUI(isPublished);
  
  // Set cover preview image
  updateCoverImagePreview(resolveImagePath(artEn.image));
  
  // Render categories checkboxes
  renderCategoriesCheckboxes(artEn.categoryIds || (artEn.categoryId ? [artEn.categoryId] : []));
  
  // Load single-textarea body values (Deserialized to HTML format for WYSIWYG)
  bodyTextEn.innerHTML = deserializeContent(artEn.content || []);
  bodyTextDe.innerHTML = deserializeContent(artDe.content || []);
  
  charCountEnLabel.textContent = `${bodyTextEn.textContent.length} characters`;
  charCountDeLabel.textContent = `${bodyTextDe.textContent.length} characters`;
  
  // Reset translation tracking
  englishIsModifiedSinceLastTranslation = false;
}

// Convert JSON array list of paragraphs into HTML for the WYSIWYG contenteditable
function deserializeContent(contentArray) {
  const result = [];
  (contentArray || []).forEach(p => {
    const trimmed = p.trim();
    if (trimmed === '') return;
    
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<p') || trimmed.startsWith('<div')) {
      result.push(trimmed);
      return;
    }
    
    // Split by newlines to preserve paragraph breaks
    const lines = trimmed.split(/\r?\n/);
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine !== '') {
        result.push(`<p>${trimmedLine}</p>`);
      }
    });
  });
  return result.join('');
}

// Convert WYSIWYG HTML structure into clean paragraph JSON array segments
function serializeContent(editorDiv) {
  const content = [];
  
  const isBlockTag = (tag) => ['p', 'div', 'h2', 'h3', 'ul', 'ol', 'li'].includes(tag);
  
  editorDiv.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.textContent.trim();
      if (val !== '') {
        const lines = val.split(/\r?\n/);
        lines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine !== '') {
            content.push(trimmedLine);
          }
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Check if this node contains any block-level element children
      const hasBlockChildren = Array.from(node.childNodes).some(child => 
        child.nodeType === Node.ELEMENT_NODE && isBlockTag(child.tagName.toLowerCase())
      );
      
      if (hasBlockChildren) {
        // Recursively serialize and flatten children
        content.push(...serializeContent(node));
      } else {
        // It has no block children. It's a leaf block or inline wrapper.
        if (tagName === 'p' || tagName === 'div') {
          const inner = node.innerHTML.trim();
          if (inner !== '' && inner !== '<br>') {
            content.push(inner);
          }
        } else if (tagName === 'h2' || tagName === 'h3' || tagName === 'ul' || tagName === 'ol') {
          content.push(node.outerHTML.trim());
        } else if (tagName === 'br') {
          // Ignore single breaks
        } else {
          const outer = node.outerHTML.trim();
          if (outer !== '') {
            content.push(outer);
          }
        }
      }
    }
  });
  return content.filter(Boolean);
}

// Update the cover image live preview
function updateCoverImagePreview(url) {
  if (url && url.trim() !== '') {
    elCoverPreview.src = url;
    elCoverPreview.classList.add('loaded');
  } else {
    elCoverPreview.src = '';
    elCoverPreview.classList.remove('loaded');
  }
}

// Render checkable categories list
function renderCategoriesCheckboxes(selectedIds) {
  const categories = blogData.en.categories;
  elCategoriesContainer.innerHTML = '';
  
  Object.keys(categories).forEach(key => {
    if (key === 'all') return; // Skip "all" category
    
    const label = document.createElement('label');
    label.className = 'category-checkbox-label';
    
    const isChecked = selectedIds.includes(key);
    
    label.innerHTML = `
      <input type="checkbox" class="category-checkbox" value="${key}" ${isChecked ? 'checked' : ''}>
      <span>${categories[key]}</span>
    `;
    
    label.querySelector('input').addEventListener('change', () => {
      saveHistoryState();
      
      const checked = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
      
      const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
      const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
      
      artEn.categoryIds = checked;
      artDe.categoryIds = checked;
      
      // Update legacy categoryId with first item
      artEn.categoryId = checked[0] || 'health';
      artDe.categoryId = checked[0] || 'health';
      
      updateHistoryButtons();
      renderSidebar();
    });
    
    elCategoriesContainer.appendChild(label);
  });
}

// WYSIWYG command runner supporting underline, list formats, increase/decrease indentation
function executeFormat(cmd) {
  if (cmd === 'tab') {
    // Tab space is represented as 4 spaces
    document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
  } else if (cmd === 'h2' || cmd === 'h3') {
    document.execCommand('formatBlock', false, cmd);
  } else if (cmd === 'createLink') {
    const url = prompt('Enter the link URL (e.g. https://example.com):');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  } else {
    document.execCommand(cmd, false, null);
  }
}

// Helper to translate text using Google Translate (unofficial client API) as primary/fallback.
async function translateWithGoogle(text) {
  if (!text || !text.trim()) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Translate returned status ${response.status}`);
  }
  const data = await response.json();
  if (data && data[0]) {
    return data[0].map(item => item[0]).join('');
  }
  return text;
}

// Helper to translate text using MyMemory API, with fallback to Google Translate if rate limits or connection errors occur.
async function translateText(text) {
  if (!text || !text.trim()) return '';
  
  try {
    if (text.length <= 500) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|de`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MyMemory API returned status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.responseData && data.responseData.translatedText) {
        const transText = data.responseData.translatedText;
        if (transText.includes("QUERY LENGTH LIMIT EXCEEDED")) {
          return await translateTextChunked(text);
        }
        if (transText.includes("MYMEMORY WARNING:") || (data.responseStatus && data.responseStatus !== 200)) {
          console.warn("MyMemory quota limit warning, falling back to Google Translate:", transText);
          return await translateWithGoogle(text);
        }
        return transText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      }
      return text;
    } else {
      return await translateTextChunked(text);
    }
  } catch (err) {
    console.warn("MyMemory failed, falling back to Google Translate:", err);
    try {
      return await translateWithGoogle(text);
    } catch (gErr) {
      console.error("Google Translate fallback also failed:", gErr);
      throw new Error(`Translation failed. MyMemory: ${err.message}. Google Translate: ${gErr.message}`);
    }
  }
}

async function translateTextChunked(text) {
  // Split by sentence endings (period, question mark, exclamation mark followed by space or end of string)
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+(\s+|$)/g) || [text];
  let result = '';
  
  for (let sentence of sentences) {
    sentence = sentence.trim();
    if (!sentence) continue;
    
    if (sentence.length > 500) {
      for (let i = 0; i < sentence.length; i += 400) {
        const subChunk = sentence.substring(i, i + 400);
        const transChunk = await translateSingleChunk(subChunk);
        result += (result ? ' ' : '') + transChunk;
      }
    } else {
      const transSentence = await translateSingleChunk(sentence);
      result += (result ? ' ' : '') + transSentence;
    }
    // Small throttle delay
    await new Promise(r => setTimeout(r, 100));
  }
  return result;
}

async function translateSingleChunk(chunk) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|de`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MyMemory API returned status ${response.status}`);
    }
    const data = await response.json();
    if (data.responseData && data.responseData.translatedText) {
      const transText = data.responseData.translatedText;
      if (transText.includes("MYMEMORY WARNING:") || (data.responseStatus && data.responseStatus !== 200)) {
        console.warn("MyMemory chunk warning, falling back to Google Translate");
        return await translateWithGoogle(chunk);
      }
      return transText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
    return chunk;
  } catch (err) {
    console.warn("MyMemory chunk translation failed, falling back to Google Translate:", err);
    try {
      return await translateWithGoogle(chunk);
    } catch (gErr) {
      console.error("Google Translate chunk translation fallback also failed:", gErr);
      throw gErr;
    }
  }
}

// Translate a specific text field
async function translateField(elEn, elDe, btnElement, fieldDisplayName) {
  const textVal = elEn.value.trim();
  if (!textVal) {
    showToast(`${fieldDisplayName} is empty!`, 'warning');
    return;
  }
  
  const originalHtml = btnElement.innerHTML;
  btnElement.disabled = true;
  btnElement.innerHTML = '<i class="spin-icon" data-lucide="loader"></i> Translating...';
  initIcons();
  
  try {
    const translated = await translateText(textVal);
    
    // Set value and trigger sync via change event (handles history state save automatically)
    elDe.value = translated;
    elDe.dispatchEvent(new Event('change'));
    
    showToast(`${fieldDisplayName} successfully translated!`, 'success');
  } catch (err) {
    console.error(`Translation failed for ${fieldDisplayName}:`, err);
    showToast(`Translation failed: ${err.message}`, 'error');
  } finally {
    btnElement.disabled = false;
    btnElement.innerHTML = originalHtml;
    initIcons();
  }
}

// Update the publication status badges and buttons
function updateArticleStatusUI(isPublished) {
  const statusBadge = document.getElementById('meta-article-status');
  if (statusBadge) {
    statusBadge.className = `badge ${isPublished ? 'badge-success' : 'badge-warning'}`;
    statusBadge.innerHTML = isPublished 
      ? `<i data-lucide="check-circle" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Published`
      : `<i data-lucide="edit-3" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Draft`;
  }
  
  if (elBtnTogglePublish) {
    elBtnTogglePublish.innerHTML = isPublished
      ? `<i data-lucide="eye-off" style="width: 14px; height: 14px;"></i> Unpublish`
      : `<i data-lucide="eye" style="width: 14px; height: 14px;"></i> Publish`;
  }
  initIcons();
}

// Helper to translate HTML string while preserving tags (e.g. <a>, <u>, etc.) from translation corruption
async function translateHtmlPreservingTags(text) {
  if (!text || !text.trim()) return '';
  const tagRegex = /<[^>]+>/g;
  const tags = [];
  
  let placeholderIndex = 0;
  const placeholderText = text.replace(tagRegex, (match) => {
    tags.push(match);
    const placeholder = `{${placeholderIndex}}`;
    placeholderIndex++;
    return placeholder;
  });
  
  let translatedText = await translateText(placeholderText);
  
  // Clean up potential spaces injected inside placeholders by translation engines
  translatedText = translatedText.replace(/\{\s*(\d+)\s*\}/g, '{$1}');
  
  for (let i = 0; i < tags.length; i++) {
    translatedText = translatedText.replaceAll(`{${i}}`, tags[i]);
  }
  
  return translatedText;
}

// Execute auto translation of English editor content to German via MyMemory
async function executeTranslation() {
  const enSerialized = serializeContent(bodyTextEn);
  if (enSerialized.length === 0) {
    showToast('English editor is empty!', 'warning');
    return false;
  }
  
  elLoadingProgressContainer.style.display = 'block';
  elLoadingModal.classList.add('open');
  elLoadingProgressBar.style.width = '0%';
  elLoadingModalMessage.textContent = 'Structuring translation segments...';
  
  try {
    const translated = [];
    
    for (let i = 0; i < enSerialized.length; i++) {
      const p = enSerialized[i];
      
      // Update progress
      const percent = Math.round((i / enSerialized.length) * 100);
      elLoadingProgressBar.style.width = `${percent}%`;
      elLoadingModalMessage.textContent = `Translating block ${i + 1} of ${enSerialized.length}...`;
      
      // Parse block tag type dynamically
      let isTag = false;
      let tagName = '';
      if (p.startsWith('<') && p.includes('>')) {
        const match = p.match(/^<([a-zA-Z0-9]+)/);
        if (match) {
          tagName = match[1].toLowerCase();
          isTag = ['h2', 'h3', 'ul', 'ol'].includes(tagName);
        }
      }
      
      let transText = '';
      if (isTag) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = p;
        const originalNode = tempDiv.firstElementChild;
        if (originalNode) {
          if (tagName === 'h2' || tagName === 'h3') {
            const textToTranslate = originalNode.textContent || originalNode.innerText;
            const translatedText = await translateText(textToTranslate);
            originalNode.textContent = translatedText;
            transText = originalNode.outerHTML;
          } else if (tagName === 'ul' || tagName === 'ol') {
            const lis = originalNode.querySelectorAll('li');
            for (let li of lis) {
              li.innerHTML = await translateHtmlPreservingTags(li.innerHTML);
            }
            transText = originalNode.outerHTML;
          }
        } else {
          transText = await translateHtmlPreservingTags(p);
        }
      } else {
        transText = await translateHtmlPreservingTags(p);
      }
      
      translated.push(transText);
      
      // Small throttle delay
      await new Promise(r => setTimeout(r, 100));
    }
    
    elLoadingProgressBar.style.width = '100%';
    elLoadingModalMessage.textContent = 'Syncing...';
    
    // Save history state before replacing DE content
    saveHistoryState();
    
    // Post-process translation to split elements that contain newline characters (\n)
    const finalTranslated = [];
    translated.forEach(t => {
      const lines = t.split(/\r?\n/);
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed !== '') {
          finalTranslated.push(trimmed);
        }
      });
    });

    bodyTextDe.innerHTML = deserializeContent(finalTranslated);
    charCountDeLabel.textContent = `${bodyTextDe.textContent.length} characters`;
    
    // Sync to model
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    artDe.content = finalTranslated;
    
    englishIsModifiedSinceLastTranslation = false;
    updateHistoryButtons();
    showToast('German translation successfully updated!', 'success');
    return true;
  } catch (err) {
    showToast(`Translation failed: ${err.message}`, 'error');
    return false;
  } finally {
    setTimeout(() => {
      elLoadingModal.classList.remove('open');
    }, 400);
  }
}

// Save all changes in memory back to the local database file (blog.json)
async function saveAllChanges() {
  // Automatically update the publish date of the active article to the current month/year on modification/save
  if (currentArticleId) {
    const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    
    if (artEn && artDe) {
      const dateOptionsEn = { month: 'long', year: 'numeric' };
      const dateStrEn = new Date().toLocaleDateString('en-US', dateOptionsEn);
      
      const dateOptionsDe = { month: 'long', year: 'numeric' };
      const dateStrDe = new Date().toLocaleDateString('de-DE', dateOptionsDe);
      
      if (artEn.date !== dateStrEn || artDe.date !== dateStrDe) {
        artEn.date = dateStrEn;
        artDe.date = dateStrDe;
        elDate.value = dateStrEn;
      }
    }
  }

  elBtnSave.disabled = true;
  elBtnSave.innerHTML = '<i class="spin-icon" data-lucide="loader"></i> Saving...';
  initIcons();
  
  try {
    const response = await fetch('/api/save-blog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(blogData, null, 2)
    });
    
    if (!response.ok) {
      const errRes = await response.json();
      throw new Error(errRes.message || 'Failed to overwrite blog.json');
    }
    
    showToast('Changes saved successfully to blog.json! (Backup created)', 'success');
  } catch (err) {
    showToast(`Error saving: ${err.message}`, 'error');
  } finally {
    elBtnSave.disabled = false;
    elBtnSave.innerHTML = '<i data-lucide="save"></i> Save Changes';
    initIcons();
  }
}

// Save draft and run pre-renderer, then open in new tab
async function triggerPreview(lang) {
  if (!currentArticleId) return;
  
  elPreviewModal.classList.remove('open');
  
  // Sync the latest editor content to model before saving
  const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
  if (artEn) {
    artEn.content = serializeContent(bodyTextEn);
  }
  const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
  if (artDe) {
    artDe.content = serializeContent(bodyTextDe);
  }
  
  // Show loading overlay
  elLoadingModalMessage.textContent = 'Saving changes & generating preview...';
  elLoadingProgressContainer.style.display = 'none'; // hide progress bar for quick preview generation
  elLoadingModal.classList.add('open');
  
  try {
    // 1. Save draft to local server blog.json
    const saveResponse = await fetch('/api/save-blog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(blogData, null, 2)
    });
    
    if (!saveResponse.ok) {
      const errRes = await saveResponse.json();
      throw new Error(errRes.message || 'Failed to save changes before preview');
    }
    
    // 2. Call preview generation API on local server
    const previewResponse = await fetch('/api/preview', {
      method: 'POST'
    });
    
    if (!previewResponse.ok) {
      const errRes = await previewResponse.json();
      throw new Error(errRes.message || 'Failed to pre-render blog posts');
    }
    
    // 3. Open preview page in a new window/tab
    const previewUrl = lang === 'en'
      ? `http://localhost:8080/journal/en/${currentArticleId}.html`
      : `http://localhost:8080/de/${currentArticleId}.html`;
    window.open(previewUrl, '_blank');
    
    showToast('Preview loaded in new tab!', 'success');
  } catch (err) {
    showToast(`Preview failed: ${err.message}`, 'error');
  } finally {
    // Close loading overlay
    elLoadingModal.classList.remove('open');
  }
}

// Global save handler verifying translation sync
async function handleSaveClick() {
  // Sync the latest editor content to model before checking!
  const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
  const currentEnContent = serializeContent(bodyTextEn);
  
  if (JSON.stringify(artEn.content) !== JSON.stringify(currentEnContent)) {
    artEn.content = currentEnContent;
    englishIsModifiedSinceLastTranslation = true;
  }
  
  const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
  artDe.content = serializeContent(bodyTextDe);

  if (englishIsModifiedSinceLastTranslation) {
    // Open confirmation prompt modal
    elConfirmModal.classList.add('open');
  } else {
    // Direct save if no modification made since last translate
    await saveAllChanges();
  }
}

// Open Publish modal and fetch suggested version
async function handlePublishClick() {
  // Sync the latest editor content to model before checking!
  if (currentArticleId) {
    const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
    if (artEn) {
      artEn.content = serializeContent(bodyTextEn);
    }
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    if (artDe) {
      artDe.content = serializeContent(bodyTextDe);
    }
  }

  // Prepopulate modal with loading state
  elPublishVersion.value = 'Loading...';
  elPublishComments.value = '';
  elPublishModal.classList.add('open');

  try {
    const response = await fetch('/api/publish-info');
    if (!response.ok) throw new Error('Failed to fetch publish info');
    const data = await response.json();
    elPublishVersion.value = data.suggestedNext || '1.0';
    elPublishComments.value = ''; // Let them write their own
  } catch (err) {
    showToast(`Error fetching suggested version: ${err.message}`, 'error');
    elPublishVersion.value = '1.0';
  }
}

// Perform publish POST request
async function executePublish() {
  const version = elPublishVersion.value.trim();
  const comments = elPublishComments.value.trim();

  if (!version) {
    showToast('Version tag is required.', 'warning');
    return;
  }

  // Hide modal
  elPublishModal.classList.remove('open');

  // Show loading modal (without progress bar)
  elLoadingProgressContainer.style.display = 'none';
  elLoadingModalMessage.textContent = 'Saving latest changes locally...';
  elLoadingModal.classList.add('open');

  try {
    // 1. Auto-save all editor and metadata state first
    await saveAllChanges();

    // 2. Publish
    elLoadingModalMessage.textContent = 'Publishing changes to pauseandmove.ch... Please wait, this may take a minute.';
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version, comments })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Publish failed');
    }

    showToast('Successfully published and updated pauseandmove.ch server!', 'success');
  } catch (err) {
    showToast(`Publish failed: ${err.message}`, 'error');
  } finally {
    elLoadingModal.classList.remove('open');
    // Restore progress container visibility
    elLoadingProgressContainer.style.display = '';
  }
}


// Open AI Copywriting assistant modal
function openAiModal(targetLang) {
  aiTargetLang = targetLang;
  
  let originalText = '';
  
  // Check if we have a valid cached selection for this pane
  if (cachedSelectionPane === targetLang && cachedSelectionText !== '') {
    originalText = cachedSelectionText;
  } else {
    // Fallback: use active editor text
    const editor = targetLang === 'en' ? bodyTextEn : bodyTextDe;
    originalText = editor.textContent.trim();
  }
  
  elAiOriginalText.textContent = originalText || "[Write some text in the editor first]";
  elAiSuggestionText.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">Generated suggestion will appear here...</div>';
  elAiSuggestionText.classList.add('done');
  
  elBtnAiApply.disabled = true;
  elAiModal.classList.add('open');
}

// Close AI Copywriting assistant modal
function closeAiModal() {
  elAiModal.classList.remove('open');
}

// Heuristic Copywrite AI suggestion engine
function generateAiSuggestion() {
  const originalText = elAiOriginalText.textContent.trim();
  if (originalText === '' || originalText.startsWith('[')) {
    showToast('No valid source text selected!', 'warning');
    return;
  }
  
  elBtnAiGenerate.disabled = true;
  elBtnAiGenerate.innerHTML = '<i class="spin-icon" data-lucide="loader"></i> AI thinking...';
  initIcons();
  
  elAiSuggestionText.innerHTML = '';
  elAiSuggestionText.classList.remove('done');
  
  const tone = elAiTone.value;
  const prompt = elAiPrompt.value.trim().toLowerCase();
  
  // Heuristics: Generate a high-quality copywrite rewrite based on tone
  let rewritten = '';
  
  if (aiTargetLang === 'en') {
    if (tone === 'somatic') {
      rewritten = "Have you noticed how your shoulders tend to creep upward when you are under pressure? This is not a physical coincidence; it's a defensive somatic reflex. The muscles in your upper back act as an emotional barometer. Massage therapy and somatic bodywork help rehydrate the sticky fascia layers and tell your nervous system that it is safe to release this defensive armor.";
    } else if (tone === 'expat') {
      rewritten = "Relocating to a new country like Switzerland is an adventure, but the stress of finding an apartment in Basel and managing registrations shows up physically in your posture. Your nervous system is constantly on high alert in this unfamiliar environment. Bodywork sessions provide expats with a physical anchor, calming the mind and helping you feel grounded and at home in your new city.";
    } else if (tone === 'seo') {
      rewritten = "Suffer from chronic back pain or shoulder tension? Experience somatic healing and deep tissue trigger point release with professional massage therapy in Basel. Our somatic bodywork treatments target fascial stiffness, ease muscle knots, and support fast stress release to keep your body moving smoothly.";
    } else if (tone === 'professional') {
      rewritten = "Our manual therapy treatments in Basel are recognized by ASCA and EGK supplementary insurance plans. We target myofascial restrictions and chronic joint stiffness through clinically-based bodywork, facilitating anatomical recovery, reducing tissue inflammation, and restoring full functional mobility.";
    } else {
      rewritten = "Our bodies tell the stories our minds try to ignore. When deadlines crowd in, the shoulders float upward like defensive shields, anchoring tension deep within the fascia. Regular manual bodywork works like a physical dialogue, encouraging the tissue to let go of its historical stress patterns and breathe again.";
    }
    
    // Customize with prompts
    if (prompt.includes('short') || prompt.includes('less')) {
      rewritten = "Under pressure, shoulders tense up automatically. This somatic response binds our fascia. Targeted manual bodywork in Basel relieves this defense reflex, signaling safety to the nervous system.";
    }
  } else {
    // German translations
    if (tone === 'somatic') {
      rewritten = "Haben Sie bemerkt, wie Ihre Schultern bei Stress unbewusst nach oben wandern? Das ist keine Laune der Natur, sondern ein somatischer Schutzreflex. Die Nackenmuskeln wirken wie ein emotionales Barometer. Massage und Körperarbeit helfen, verklebte Faszien zu rehydrieren und signalisieren dem Nervensystem, dass es die Anspannung sicher loslassen kann.";
    } else if (tone === 'expat') {
      rewritten = "Ein Umzug in die Schweiz ist aufregend, aber der Stress (Wohnungssuche in Basel, Registrierungen) zeigt sich oft in Ihrer Haltung. Das Nervensystem ist permanent gefordert. Professionelle Körpertherapie wirkt als erdender Anker für Expats, beruhigt das Nervensystem und hilft Ihnen, sich in der neuen Heimat wohlzufühlen.";
    } else if (tone === 'seo') {
      rewritten = "Leiden Sie unter Rückenschmerzen oder Nackenverspannungen? Buchen Sie professionelle Massage-Therapie und Faszientherapie in Basel für effektiven Stressabbau. Unsere somatische Körperarbeit löst Triggerpunkte und verklebte Faszien nachhaltig.";
    } else if (tone === 'professional') {
      rewritten = "Unsere manuellen Körpertherapien in Basel sind ASCA- und EGK-krankenkassenanerkannt (Zusatzversicherung). Wir behandeln gezielt myofasziale Beschwerden und Gelenksteifigkeit zur anatomischen Regeneration und Wiederherstellung der Mobilität.";
    } else {
      rewritten = "Der Körper spricht, wenn der Geist schweigt. Bei Stress ziehen sich die Schultern wie Schutzschilde hoch und halten die Last fest. Somatische Körperarbeit regt einen tiefen Dialog mit dem Gewebe an, löst alte Spannungsmuster aus den Faszien und bringt die Energie wieder ins Fließen.";
    }
    
    if (prompt.includes('kurz') || prompt.includes('weniger')) {
      rewritten = "Unter Druck spannen sich Schultern reflexartig an. Faszien verkleben. Gezielte manuelle Körpertherapie in Basel löst diesen Schutzreflex und signalisiert dem Nervensystem tiefe Sicherheit.";
    }
  }
  
  const defaultParagraphs = [
    "Have you noticed how your shoulders tend to creep upward when you are under pressure? This is not a physical coincidence; it's a defensive somatic reflex. The muscles in your upper back act as an emotional barometer. Massage therapy and somatic bodywork help rehydrate the sticky fascia layers and tell your nervous system that it is safe to release this defensive armor.",
    "Haben Sie bemerkt, wie Ihre Schultern bei Stress unbewusst nach oben wandern? Das ist keine Laune der Natur, sondern ein somatischer Schutzreflex. Die Nackenmuskeln wirken wie ein emotionales Barometer. Massage und Körperarbeit helfen, verklebte Faszien zu rehydrieren und signalisieren dem Nervensystem, dass es die Anspannung sicher loslassen kann.",
    "Moving to a new city is widely ranked as one of life's most intense stressors. While we focus on the logistics — finding an apartment in Basel, registering at the town hall, setting up bank accounts — our bodies are quietly bearing the brunt of the transition. This is relocation stress, and it is a physical reality."
  ];
  
  const isDefault = defaultParagraphs.map(p => p.trim().toLowerCase()).includes(originalText.trim().toLowerCase());

  // If rewriting custom text (not one of the defaults) and no match, do a generic smart replacement
  if (!isDefault) {
    if (aiTargetLang === 'en') {
      rewritten = `[Optimized for ${tone} style]: ` + originalText.replace(/tenses/g, "somatically contracts").replace(/stress/g, "nervous system overload") + " Experience lasting structural integration and emotional release.";
    } else {
      rewritten = `[Optimiert für ${tone}-Stil]: ` + originalText.replace(/verspannt/g, "somatisch kontrahiert").replace(/Stress/g, "Überlastung des Nervensystems") + " Für nachhaltige strukturelle Integration und Loslassen.";
    }
  }
  
  aiSuggestedText = rewritten;
  
  // Simulated typing animation
  let index = 0;
  const interval = setInterval(() => {
    if (index < rewritten.length) {
      elAiSuggestionText.textContent += rewritten.charAt(index);
      index++;
    } else {
      clearInterval(interval);
      elAiSuggestionText.classList.add('done');
      elBtnAiGenerate.disabled = false;
      elBtnAiGenerate.innerHTML = '<i data-lucide="wand-2"></i> Rewrite Selected Text';
      elBtnAiApply.disabled = false;
      initIcons();
    }
  }, 10);
}

// Apply suggestion to active editor
function applyAiSuggestion() {
  if (aiSuggestedText === '') return;
  
  // Save history state
  saveHistoryState();
  
  const activeEditor = aiTargetLang === 'en' ? bodyTextEn : bodyTextDe;
  activeEditor.focus();
  
  if (cachedSelectionRange && cachedSelectionPane === aiTargetLang && cachedSelectionText !== '') {
    // Restore selection using cachedSelectionRange
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(cachedSelectionRange);
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    // Create new node containing HTML paragraphs
    const paragraphs = aiSuggestedText.split(/\n\s*\n/);
    const container = document.createDocumentFragment();
    
    paragraphs.forEach(p => {
      const pNode = document.createElement('p');
      pNode.innerHTML = p;
      container.appendChild(pNode);
    });
    
    range.insertNode(container);
  } else {
    // Replace whole editor text
    activeEditor.innerHTML = deserializeContent(aiSuggestedText.split(/\n\s*\n/));
  }
  
  // Trigger input changes to update word count and change state
  activeEditor.dispatchEvent(new Event('input'));
  activeEditor.dispatchEvent(new Event('change'));
  
  // Clear cached selection
  cachedSelectionRange = null;
  cachedSelectionText = '';
  cachedSelectionPane = null;
  
  closeAiModal();
  showToast('AI copywriting suggestion applied!');
}

// Sync text inputs to model values
function bindInputSync(el, fieldName, isArray = false, isGerman = false) {
  el.addEventListener('change', () => {
    saveHistoryState();
    
    const art = isGerman 
      ? blogData.de.articles.find(a => a.id === currentArticleId)
      : blogData.en.articles.find(a => a.id === currentArticleId);
      
    let val = el.value;
    if (isArray) {
      val = val.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    art[fieldName] = val;
    
    // Sync shared metadata attributes
    if (!isGerman && (fieldName === 'date' || fieldName === 'readTime' || fieldName === 'image' || fieldName === 'author')) {
      const deArt = blogData.de.articles.find(a => a.id === currentArticleId);
      deArt[fieldName] = val;
      
      if (fieldName === 'image') {
        updateCoverImagePreview(val);
      }
    }
    
    updateHistoryButtons();
    renderSidebar();
  });
}

// --- Local File Path Resolution ---
function resolveImagePath(val) {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.match(/^[a-zA-Z]:\\/) || trimmed.includes('\\') || (trimmed.startsWith('/') && !trimmed.startsWith('http') && !trimmed.startsWith('data:'))) {
    return '/api/load-local-image?path=' + encodeURIComponent(trimmed);
  }
  return trimmed;
}

// --- Image Resizing Assistant State ---
let resizeModalOpen = false;
let resizeImage = null; // Image object
let originalResizeImage = null; // The original non-extrapolated image
let resizeCanvas = null;
let resizeCtx = null;
let resizeMode = 'crop'; // 'crop' | 'blur' | 'solid' | 'outpaint'
let resizeBgColor = '#0B0F19';
let cropBox = { x: 0, y: 0, w: 0, h: 0 };
let isDraggingCrop = false;
let dragStartMouse = { x: 0, y: 0 };
let dragStartCrop = { x: 0, y: 0 };
let dragStartCropBox = { x: 0, y: 0, w: 0, h: 0 };
let activeResizeHandle = null; // null | 'tl' | 'tr' | 'bl' | 'br'
let chatMessages = [];
let outpaintImageUrl = null;
let isOutpaintingLoading = false;

// High quality upscaling (extrapolation) for small images in crop mode
function extrapolateImage(img, callback) {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  
  if (imgW >= 900 && imgH >= 600) {
    callback(img);
    return;
  }
  
  const scale = Math.max(900 / imgW, 600 / imgH);
  const newW = Math.ceil(imgW * scale);
  const newH = Math.ceil(imgH * scale);
  
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, newW, newH);
  
  const newImg = new Image();
  newImg.crossOrigin = "anonymous";
  newImg.onload = () => {
    callback(newImg);
  };
  newImg.onerror = () => {
    console.error("Failed to load extrapolated image, falling back to original");
    callback(img);
  };
  newImg.src = canvas.toDataURL('image/jpeg', 0.95);
}

// DOM pointers for resizing modal
const elResizeModal = document.getElementById('image-resize-modal');
const elBtnResizeClose = document.getElementById('btn-resize-close');
const elBtnResizeCancel = document.getElementById('btn-resize-cancel');
const elBtnResizeApply = document.getElementById('btn-resize-apply');
const elResizeChatHistory = document.getElementById('resize-chat-history');
const elResizeChatInput = document.getElementById('resize-chat-input');
const elBtnResizeSend = document.getElementById('btn-resize-send');
const elCanvasSizeInfo = document.getElementById('canvas-size-info');
const elResizeCanvas = document.getElementById('resize-canvas');

const elResizeImportView = document.getElementById('resize-import-view');
const elResizeEditorView = document.getElementById('resize-editor-view');
const elResizeFileInput = document.getElementById('resize-file-input');
const elResizePathInput = document.getElementById('resize-path-input');
const elBtnResizePathLoad = document.getElementById('btn-resize-path-load');
const elResizeDropZone = document.getElementById('resize-drop-zone');
const elBtnResizeBack = document.getElementById('btn-resize-back');

// Auto-resize and compress large images to 1200x800 JPEG for web optimization
function autoResizeAndCompress(img) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 1200, 800);
    resolve(canvas.toDataURL('image/jpeg', 0.90));
  });
}

// Check dimensions & aspect ratio of any newly imported image
function checkAndProcessNewImage(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const ratio = w / h;
    
    // Trigger assistant if aspect ratio is not 3:2 (1.5) or image width is too small (< 600px)
    if (Math.abs(ratio - 1.5) > 0.02 || w < 600) {
      openResizeModal(img);
    } else {
      // If the image is very large, automatically resize it to 1200x800 and compress it
      if (w > 1600) {
        showToast("Large image detected. Auto-optimizing for web...", "info");
        autoResizeAndCompress(img).then(compressedSrc => {
          updateCoverImageValue(compressedSrc).then(() => {
            if (resizeModalOpen) {
              closeResizeModal();
            }
          });
        });
      } else {
        updateCoverImageValue(src).then(() => {
          if (resizeModalOpen) {
            closeResizeModal();
          }
        });
      }
    }
  };
  img.onerror = () => {
    showToast("Failed to load image. Please verify the URL or path.", "error");
  };
  img.src = src;
}

// Update DB and preview with automatically copied local assets path
async function updateCoverImageValue(src) {
  if (src.startsWith('assets/')) {
    saveHistoryState();
    elImage.value = src;
    updateCoverImagePreview(resolveImagePath(src));
    const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    artEn.image = src;
    artDe.image = src;
    updateHistoryButtons();
    renderSidebar();
    return;
  }
  
  try {
    showToast("Copying image to site assets...", "info");
    
    const response = await fetch(src);
    const blob = await response.blob();
    
    const reader = new FileReader();
    const uploadPromise = new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          
          let ext = 'jpg';
          const match = base64.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
          if (match) {
            const mimeType = match[1].toLowerCase();
            if (mimeType.includes('png')) ext = 'png';
            else if (mimeType.includes('gif')) ext = 'gif';
            else if (mimeType.includes('svg')) ext = 'svg';
            else if (mimeType.includes('webp')) ext = 'webp';
          }
          
          const uploadRes = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image: base64,
              articleId: currentArticleId,
              extension: ext
            })
          });
          
          if (!uploadRes.ok) throw new Error("Upload failed");
          const data = await uploadRes.json();
          if (data.status === 'success') {
            const savedPath = data.path;
            saveHistoryState();
            elImage.value = savedPath;
            updateCoverImagePreview(resolveImagePath(savedPath));
            const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
            const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
            artEn.image = savedPath;
            artDe.image = savedPath;
            updateHistoryButtons();
            renderSidebar();
            showToast("Image successfully copied to assets!", "success");
            resolve();
          } else {
            throw new Error(data.message || "Upload failed");
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read image blob"));
      reader.readAsDataURL(blob);
    });
    
    await uploadPromise;
  } catch (err) {
    console.error(err);
    saveHistoryState();
    elImage.value = src;
    updateCoverImagePreview(resolveImagePath(src));
    const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    artEn.image = src;
    artDe.image = src;
    updateHistoryButtons();
    renderSidebar();
  }
}

// Open Cover Image Assistant Modal (Unified Import / Resizer)
function openResizeModal(img) {
  elResizeModal.classList.add('open');
  resizeModalOpen = true;

  if (!img) {
    // State 1: Import View
    elResizeImportView.style.display = 'flex';
    elResizeEditorView.style.display = 'none';
    elBtnResizeBack.style.display = 'none';
    elBtnResizeApply.style.display = 'none';
    elBtnResizeCancel.style.display = 'inline-block';
    
    elResizePathInput.value = '';
    resizeImage = null;
    originalResizeImage = null;
    return;
  }

  originalResizeImage = img;

  if (img.naturalWidth < 900 || img.naturalHeight < 600) {
    extrapolateImage(img, (extrapolatedImg) => {
      initializeResizeEditor(extrapolatedImg, true);
    });
  } else {
    initializeResizeEditor(img, false);
  }
}

function initializeResizeEditor(img, wasExtrapolated) {
  // State 2: Editor (Resizing) View
  elResizeImportView.style.display = 'none';
  elResizeEditorView.style.display = 'grid';
  elBtnResizeBack.style.display = 'inline-block';
  elBtnResizeApply.style.display = 'inline-block';
  elBtnResizeCancel.style.display = 'inline-block';

  resizeImage = img;
  resizeMode = 'crop';
  resizeBgColor = '#0B0F19';
  chatMessages = [];
  outpaintImageUrl = null;
  isOutpaintingLoading = false;
  
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  
  let cropW, cropH;
  if (imgW / imgH > 1.5) {
    cropH = imgH;
    cropW = imgH * 1.5;
  } else {
    cropW = imgW;
    cropH = cropW / 1.5;
  }
  
  cropBox = {
    x: (imgW - cropW) / 2,
    y: (imgH - cropH) / 2,
    w: cropW,
    h: cropH
  };
  
  resizeCanvas = elResizeCanvas;
  resizeCtx = resizeCanvas.getContext('2d');
  
  const origW = originalResizeImage.naturalWidth;
  const origH = originalResizeImage.naturalHeight;
  elCanvasSizeInfo.textContent = `Original: ${origW}x${origH} (Ratio: ${(origW/origH).toFixed(2)}) -> Target: 3:2 (900x600)`;
  
  // Clear chat
  elResizeChatHistory.innerHTML = '';
  
  if (wasExtrapolated) {
    addChatMsg('ai', `I noticed this image is smaller than the 900x600 target canvas. I have expanded it by **extrapolation** to **${imgW}x${imgH}** so that cropping is possible.`);
  } else {
    addChatMsg('ai', `Hello! I noticed this image is **${imgW}x${imgH}** (Aspect Ratio: **${(imgW/imgH).toFixed(2)}**). Our blog requires a cover image with a **3:2** ratio (ideally **900x600**).`);
  }
  addChatMsg('ai', `How would you like to fit this image? You can click the presets below, drag the crop frame on the canvas, or talk to me!`);
  
  drawResizeCanvas();
  setupCanvasEvents();
}

function closeResizeModal() {
  elResizeModal.classList.remove('open');
  resizeModalOpen = false;
}

// Get scaling bounds to render the full image fitted in canvas
function getScaleInfo() {
  const img = (resizeMode === 'crop') ? resizeImage : originalResizeImage;
  const imgW = img ? img.naturalWidth : 900;
  const imgH = img ? img.naturalHeight : 600;
  
  const scale = Math.min(900 / imgW, 600 / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (900 - w) / 2;
  const y = (600 - h) / 2;
  
  return { scale, x, y, w, h };
}

// Render Crop overlay / Blurred Margins / Solid Margins / Outpaint
function drawResizeCanvas() {
  if (!resizeImage || !resizeCanvas) return;
  
  const img = (resizeMode === 'crop') ? resizeImage : originalResizeImage;
  if (!img) return;
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  
  resizeCanvas.width = 900;
  resizeCanvas.height = 600;
  
  const ctx = resizeCtx;
  ctx.clearRect(0, 0, 900, 600);
  
  const s = getScaleInfo();
  
  if (resizeMode === 'crop') {
    ctx.drawImage(img, s.x, s.y, s.w, s.h);
    
    // semi-transparent mask
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, 900, 600);
    
    const canvasCropX = s.x + cropBox.x * s.scale;
    const canvasCropY = s.y + cropBox.y * s.scale;
    const canvasCropW = cropBox.w * s.scale;
    const canvasCropH = cropBox.h * s.scale;
    
    // Draw cropped region clearly
    ctx.save();
    ctx.beginPath();
    ctx.rect(canvasCropX, canvasCropY, canvasCropW, canvasCropH);
    ctx.clip();
    ctx.drawImage(img, s.x, s.y, s.w, s.h);
    ctx.restore();
    
    // Draw crop border
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvasCropX, canvasCropY, canvasCropW, canvasCropH);
    
    // Handles
    ctx.fillStyle = '#4F46E5';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    const hs = 10;
    
    const drawHandle = (hx, hy) => {
      ctx.fillRect(hx - hs/2, hy - hs/2, hs, hs);
      ctx.strokeRect(hx - hs/2, hy - hs/2, hs, hs);
    };
    
    drawHandle(canvasCropX, canvasCropY);
    drawHandle(canvasCropX + canvasCropW, canvasCropY);
    drawHandle(canvasCropX, canvasCropY + canvasCropH);
    drawHandle(canvasCropX + canvasCropW, canvasCropY + canvasCropH);
    
  } else if (resizeMode === 'blur') {
    ctx.save();
    ctx.filter = 'blur(16px) brightness(0.65)';
    ctx.drawImage(img, -20, -20, 940, 640);
    ctx.restore();
    
    ctx.drawImage(img, s.x, s.y, s.w, s.h);
    
  } else if (resizeMode === 'solid') {
    ctx.fillStyle = resizeBgColor;
    ctx.fillRect(0, 0, 900, 600);
    
    ctx.drawImage(img, s.x, s.y, s.w, s.h);
    
  } else if (resizeMode === 'outpaint') {
    if (outpaintImageUrl) {
      const outpaintImg = new Image();
      outpaintImg.crossOrigin = "anonymous";
      outpaintImg.onload = () => {
        ctx.drawImage(outpaintImg, 0, 0, 900, 600);
      };
      outpaintImg.src = outpaintImageUrl;
    } else {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 900, 600);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isOutpaintingLoading ? 'Generating AI Outpainting background...' : 'Deep AI Outpaint (Use Chat to generate)', 450, 300);
    }
  }
}

// Drag handlers for cropping frame
function setupCanvasEvents() {
  const canvas = elResizeCanvas;
  
  canvas.onmousedown = (e) => {
    if (resizeMode !== 'crop') return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 900;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 600;
    
    const s = getScaleInfo();
    const canvasCropX = s.x + cropBox.x * s.scale;
    const canvasCropY = s.y + cropBox.y * s.scale;
    const canvasCropW = cropBox.w * s.scale;
    const canvasCropH = cropBox.h * s.scale;
    
    const handleSize = 12;
    const isNear = (x1, y1, x2, y2) => Math.abs(x1 - x2) <= handleSize && Math.abs(y1 - y2) <= handleSize;
    
    if (isNear(mouseX, mouseY, canvasCropX, canvasCropY)) {
      activeResizeHandle = 'tl';
    } else if (isNear(mouseX, mouseY, canvasCropX + canvasCropW, canvasCropY)) {
      activeResizeHandle = 'tr';
    } else if (isNear(mouseX, mouseY, canvasCropX, canvasCropY + canvasCropH)) {
      activeResizeHandle = 'bl';
    } else if (isNear(mouseX, mouseY, canvasCropX + canvasCropW, canvasCropY + canvasCropH)) {
      activeResizeHandle = 'br';
    } else if (mouseX >= canvasCropX && mouseX <= canvasCropX + canvasCropW &&
               mouseY >= canvasCropY && mouseY <= canvasCropY + canvasCropH) {
      isDraggingCrop = true;
      dragStartMouse = { x: mouseX, y: mouseY };
      dragStartCrop = { x: cropBox.x, y: cropBox.y };
    }
    
    if (activeResizeHandle) {
      dragStartMouse = { x: mouseX, y: mouseY };
      dragStartCropBox = { x: cropBox.x, y: cropBox.y, w: cropBox.w, h: cropBox.h };
    }
  };
  
  canvas.onmousemove = (e) => {
    if (resizeMode !== 'crop') return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 900;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 600;
    
    const s = getScaleInfo();
    const canvasCropX = s.x + cropBox.x * s.scale;
    const canvasCropY = s.y + cropBox.y * s.scale;
    const canvasCropW = cropBox.w * s.scale;
    const canvasCropH = cropBox.h * s.scale;
    
    if (activeResizeHandle) {
      const dx = (mouseX - dragStartMouse.x) / s.scale;
      const dy = (mouseY - dragStartMouse.y) / s.scale;
      const img = resizeImage;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const minW = 30;
      let newW, newH, maxW;
      
      if (activeResizeHandle === 'br') {
        maxW = Math.min(imgW - dragStartCropBox.x, (imgH - dragStartCropBox.y) * 1.5);
        newW = Math.max(minW, Math.min(maxW, dragStartCropBox.w + dx));
        newH = newW / 1.5;
        cropBox.w = newW;
        cropBox.h = newH;
      } else if (activeResizeHandle === 'bl') {
        maxW = Math.min(dragStartCropBox.x + dragStartCropBox.w, (imgH - dragStartCropBox.y) * 1.5);
        newW = Math.max(minW, Math.min(maxW, dragStartCropBox.w - dx));
        newH = newW / 1.5;
        cropBox.w = newW;
        cropBox.h = newH;
        cropBox.x = dragStartCropBox.x + dragStartCropBox.w - newW;
      } else if (activeResizeHandle === 'tr') {
        maxW = Math.min(imgW - dragStartCropBox.x, (dragStartCropBox.y + dragStartCropBox.h) * 1.5);
        newW = Math.max(minW, Math.min(maxW, dragStartCropBox.w + dx));
        newH = newW / 1.5;
        cropBox.w = newW;
        cropBox.h = newH;
        cropBox.y = dragStartCropBox.y + dragStartCropBox.h - newH;
      } else if (activeResizeHandle === 'tl') {
        maxW = Math.min(dragStartCropBox.x + dragStartCropBox.w, (dragStartCropBox.y + dragStartCropBox.h) * 1.5);
        newW = Math.max(minW, Math.min(maxW, dragStartCropBox.w - dx));
        newH = newW / 1.5;
        cropBox.w = newW;
        cropBox.h = newH;
        cropBox.x = dragStartCropBox.x + dragStartCropBox.w - newW;
        cropBox.y = dragStartCropBox.y + dragStartCropBox.h - newH;
      }
      drawResizeCanvas();
    } else if (isDraggingCrop) {
      const dx = (mouseX - dragStartMouse.x) / s.scale;
      const dy = (mouseY - dragStartMouse.y) / s.scale;
      
      let newX = dragStartCrop.x + dx;
      let newY = dragStartCrop.y + dy;
      
      const imgW = resizeImage.naturalWidth;
      const imgH = resizeImage.naturalHeight;
      
      newX = Math.max(0, Math.min(imgW - cropBox.w, newX));
      newY = Math.max(0, Math.min(imgH - cropBox.h, newY));
      
      cropBox.x = newX;
      cropBox.y = newY;
      
      drawResizeCanvas();
    } else {
      const handleSize = 12;
      const isNear = (x1, y1, x2, y2) => Math.abs(x1 - x2) <= handleSize && Math.abs(y1 - y2) <= handleSize;
      
      if (isNear(mouseX, mouseY, canvasCropX, canvasCropY) ||
          isNear(mouseX, mouseY, canvasCropX + canvasCropW, canvasCropY + canvasCropH)) {
        canvas.style.cursor = 'nwse-resize';
      } else if (isNear(mouseX, mouseY, canvasCropX + canvasCropW, canvasCropY) ||
                 isNear(mouseX, mouseY, canvasCropX, canvasCropY + canvasCropH)) {
        canvas.style.cursor = 'nesw-resize';
      } else if (mouseX >= canvasCropX && mouseX <= canvasCropX + canvasCropW &&
                 mouseY >= canvasCropY && mouseY <= canvasCropY + canvasCropH) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };
  
  window.onmouseup = () => {
    isDraggingCrop = false;
    activeResizeHandle = null;
  };
}

// Add chat bubble
function addChatMsg(sender, text) {
  const msg = document.createElement('div');
  msg.className = `chat-msg chat-msg-${sender}`;
  msg.innerHTML = text.replace(/\*\*(.*?)\*\?/g, '<strong>$1</strong>');
  elResizeChatHistory.appendChild(msg);
  elResizeChatHistory.scrollTop = elResizeChatHistory.scrollHeight;
}

// Send chat message
function handleResizeChatSend() {
  const text = elResizeChatInput.value.trim();
  if (text === '') return;
  
  elResizeChatInput.value = '';
  addChatMsg('user', text);
  
  const lower = text.toLowerCase();
  setTimeout(() => {
    processChatCommand(lower);
  }, 600);
}

// Parse conversational resizer commands
function processChatCommand(cmd) {
  const imgW = resizeImage.naturalWidth;
  const imgH = resizeImage.naturalHeight;
  
  if (cmd.includes('crop')) {
    resizeMode = 'crop';
    
    if (cmd.includes('right')) {
      cropBox.x = imgW - cropBox.w;
      addChatMsg('ai', "I have shifted the crop box to the **right side**.");
    } else if (cmd.includes('left')) {
      cropBox.x = 0;
      addChatMsg('ai', "I have shifted the crop box to the **left side**.");
    } else if (cmd.includes('top') || cmd.includes('up')) {
      cropBox.y = 0;
      addChatMsg('ai', "I have shifted the crop box to the **top**.");
    } else if (cmd.includes('bottom') || cmd.includes('down')) {
      cropBox.y = imgH - cropBox.h;
      addChatMsg('ai', "I have shifted the crop box to the **bottom**.");
    } else if (cmd.includes('center')) {
      cropBox.x = (imgW - cropBox.w) / 2;
      cropBox.y = (imgH - cropBox.h) / 2;
      addChatMsg('ai', "I have centered the crop box.");
    } else {
      addChatMsg('ai', "Switched to **Crop Mode**. You can drag the crop frame on the canvas or tell me to shift it (e.g. *'crop right'*, *'crop left'*).");
    }
    drawResizeCanvas();
    return;
  }
  
  if (cmd.includes('right') && resizeMode === 'crop') {
    cropBox.x = Math.min(imgW - cropBox.w, cropBox.x + cropBox.w * 0.2);
    addChatMsg('ai', "Moved crop box slightly to the **right**.");
    drawResizeCanvas();
    return;
  }
  if (cmd.includes('left') && resizeMode === 'crop') {
    cropBox.x = Math.max(0, cropBox.x - cropBox.w * 0.2);
    addChatMsg('ai', "Moved crop box slightly to the **left**.");
    drawResizeCanvas();
    return;
  }
  if (cmd.includes('up') && resizeMode === 'crop') {
    cropBox.y = Math.max(0, cropBox.y - cropBox.h * 0.2);
    addChatMsg('ai', "Moved crop box slightly **up**.");
    drawResizeCanvas();
    return;
  }
  if (cmd.includes('down') && resizeMode === 'crop') {
    cropBox.y = Math.min(imgH - cropBox.h, cropBox.y + cropBox.h * 0.2);
    addChatMsg('ai', "Moved crop box slightly **down**.");
    drawResizeCanvas();
    return;
  }
  
  if (cmd.includes('zoom in') || cmd.includes('zoomin') || cmd.includes('smaller') || cmd.includes('shrink')) {
    if (resizeMode !== 'crop') resizeMode = 'crop';
    const cx = cropBox.x + cropBox.w / 2;
    const cy = cropBox.y + cropBox.h / 2;
    let newW = cropBox.w * 0.8;
    const minW = 30;
    if (newW < minW) newW = minW;
    const newH = newW / 1.5;
    let newX = cx - newW / 2;
    let newY = cy - newH / 2;
    newX = Math.max(0, Math.min(imgW - newW, newX));
    newY = Math.max(0, Math.min(imgH - newH, newY));
    cropBox = { x: newX, y: newY, w: newW, h: newH };
    addChatMsg('ai', "I have zoomed in by making the crop box **20% smaller**.");
    drawResizeCanvas();
    return;
  }
  if (cmd.includes('zoom out') || cmd.includes('zoomout') || cmd.includes('larger') || cmd.includes('bigger') || cmd.includes('enlarge')) {
    if (resizeMode !== 'crop') resizeMode = 'crop';
    const cx = cropBox.x + cropBox.w / 2;
    const cy = cropBox.y + cropBox.h / 2;
    let newW = cropBox.w * 1.2;
    const maxW = Math.min(imgW, imgH * 1.5);
    if (newW > maxW) newW = maxW;
    const newH = newW / 1.5;
    let newX = cx - newW / 2;
    let newY = cy - newH / 2;
    newX = Math.max(0, Math.min(imgW - newW, newX));
    newY = Math.max(0, Math.min(imgH - newH, newY));
    cropBox = { x: newX, y: newY, w: newW, h: newH };
    addChatMsg('ai', "I have zoomed out by making the crop box **20% larger**.");
    drawResizeCanvas();
    return;
  }
  
  if (cmd.includes('blur')) {
    resizeMode = 'blur';
    addChatMsg('ai', "Switched to **Blur Padding Mode**. I have added blurred margins on the margins to fill out the 3:2 ratio.");
    drawResizeCanvas();
    return;
  }
  
  if (cmd.includes('solid') || cmd.includes('background') || cmd.includes('color') || cmd.includes('black') || cmd.includes('white') || cmd.includes('gray')) {
    resizeMode = 'solid';
    if (cmd.includes('white')) {
      resizeBgColor = '#FFFFFF';
      addChatMsg('ai', "Switched to **Solid Padding Mode** with a **white background**.");
    } else if (cmd.includes('black')) {
      resizeBgColor = '#0B0F19';
      addChatMsg('ai', "Switched to **Solid Padding Mode** with a **dark background**.");
    } else if (cmd.includes('gray') || cmd.includes('grey')) {
      resizeBgColor = '#334155';
      addChatMsg('ai', "Switched to **Solid Padding Mode** with a **gray background**.");
    } else {
      addChatMsg('ai', "Switched to **Solid Padding Mode**. You can ask for a color like *'make background white'* or *'make background black'*.");
    }
    drawResizeCanvas();
    return;
  }
  
  if (cmd.includes('outpaint') || cmd.includes('deep') || cmd.includes('generat')) {
    triggerOutpainting();
    return;
  }
  
  if (cmd.includes('hello') || cmd.includes('hi')) {
    addChatMsg('ai', "Hello! How can I assist you with resizing your image? We can crop it, pad it, or run an AI outpaint.");
  } else if (cmd.includes('help')) {
    addChatMsg('ai', "You can tell me commands like: **'crop right'**, **'add blur padding'**, **'make background white'**, or **'deep outpaint'** to generate a wider AI background!");
  } else {
    addChatMsg('ai', `I'm not sure I understood that command. Try saying:
* **"crop right"** or **"crop center"**
* **"add blur padding"**
* **"make background white"**
* **"deep AI outpaint"**`);
  }
}

// AI Outpainting Generator using Pollinations AI
function triggerOutpainting() {
  resizeMode = 'outpaint';
  outpaintImageUrl = null;
  isOutpaintingLoading = true;
  drawResizeCanvas();
  
  const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
  const keywordsText = (artEn.keywords || []).slice(0, 3).join(', ');
  
  let promptSubject = keywordsText || artEn.title || 'wellness massage therapy session';
  
  addChatMsg('ai', `Starting **Deep AI Outpainting**... I am writing a context-matching background generation prompt for: *"${promptSubject}"*`);
  addChatMsg('ai', `Painting extended 3:2 background. Please wait a few seconds...`);
  
  const cleanSubject = promptSubject.replace(/find/i, '').replace(/generate/i, '').replace(/picture/i, '').replace(/photo/i, '').trim();
  const seed = Math.floor(Math.random() * 100000);
  const outpaintUrl = `https://image.pollinations.ai/p/photorealistic%20wide%20angle%203%202%20stock%20photo%20of%20${encodeURIComponent(cleanSubject)}?width=900&height=600&nologo=true&seed=${seed}`;
  
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    outpaintImageUrl = outpaintUrl;
    isOutpaintingLoading = false;
    addChatMsg('ai', "Deep AI outpainting completed successfully! The extended background has been painted on the canvas.");
    drawResizeCanvas();
  };
  img.onerror = () => {
    isOutpaintingLoading = false;
    addChatMsg('ai', "Deep AI outpainting failed to generate. Please try again or choose **Blur Padding**.");
    drawResizeCanvas();
  };
  img.src = outpaintUrl;
}

window.triggerResizePreset = function(type) {
  if (type === 'crop') {
    processChatCommand('crop');
  } else if (type === 'blur') {
    processChatCommand('blur');
  } else if (type === 'solid') {
    processChatCommand('solid');
  } else if (type === 'outpaint') {
    processChatCommand('outpaint');
  }
};

// Render final output to base64
function getFinalImageBase64() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 900;
  tempCanvas.height = 600;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (resizeMode === 'crop') {
    tempCtx.drawImage(resizeImage, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, 900, 600);
  } else if (resizeMode === 'blur') {
    tempCtx.save();
    tempCtx.filter = 'blur(16px) brightness(0.65)';
    tempCtx.drawImage(originalResizeImage, -20, -20, 940, 640);
    tempCtx.restore();
    
    const s = getScaleInfo();
    tempCtx.drawImage(originalResizeImage, s.x, s.y, s.w, s.h);
  } else if (resizeMode === 'solid') {
    tempCtx.fillStyle = resizeBgColor;
    tempCtx.fillRect(0, 0, 900, 600);
    
    const s = getScaleInfo();
    tempCtx.drawImage(originalResizeImage, s.x, s.y, s.w, s.h);
  } else if (resizeMode === 'outpaint') {
    tempCtx.drawImage(elResizeCanvas, 0, 0, 900, 600);
  }
  
  return tempCanvas.toDataURL('image/jpeg', 0.92);
}

// Upload the cropped/padded image back to assets and save Cover Image
async function applyResizeAndSave() {
  elBtnResizeApply.disabled = true;
  elBtnResizeApply.innerHTML = '<i class="spin-icon" data-lucide="loader"></i> Saving...';
  initIcons();
  
  try {
    const base64 = getFinalImageBase64();
    
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64,
        articleId: currentArticleId,
        extension: 'jpg'
      })
    });
    
    if (!response.ok) throw new Error("Server failed to save image");
    
    const data = await response.json();
    if (data.status === 'success') {
      const savedPath = data.path;
      
      saveHistoryState();
      
      elImage.value = savedPath;
      updateCoverImagePreview(resolveImagePath(savedPath));
      
      const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
      const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
      artEn.image = savedPath;
      artDe.image = savedPath;
      
      updateHistoryButtons();
      renderSidebar();
      
      elResizeModal.classList.remove('open');
      resizeModalOpen = false;
      
      showToast("Cover image successfully resized and saved to assets!", "success");
    } else {
      throw new Error(data.message || "Upload failed");
    }
  } catch (err) {
    showToast(`Failed to apply changes: ${err.message}`, 'error');
  } finally {
    elBtnResizeApply.disabled = false;
    elBtnResizeApply.innerHTML = '<i data-lucide="check"></i> Apply & Save Cover';
    initIcons();
  }
}



// Bind event listeners
function bindEvents() {
  // Search
  elSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderSidebar();
  });

  // Track selection change to prevent selection loss on button clicks
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      const isInsideEn = bodyTextEn && bodyTextEn.contains(container);
      const isInsideDe = bodyTextDe && bodyTextDe.contains(container);
      
      if (isInsideEn) {
        cachedSelectionRange = range.cloneRange();
        cachedSelectionText = selection.toString().trim();
        cachedSelectionPane = 'en';
      } else if (isInsideDe) {
        cachedSelectionRange = range.cloneRange();
        cachedSelectionText = selection.toString().trim();
        cachedSelectionPane = 'de';
      }
    }
  });
  
  // Keypress Tab Interceptors & Ctrl+K Shortcuts for editors
  const handleEditorKeydown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      executeFormat('tab');
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      executeFormat('createLink');
      // trigger input event to serialize and save changes
      e.currentTarget.dispatchEvent(new Event('input'));
    }
  };
  
  bodyTextEn.addEventListener('keydown', handleEditorKeydown);
  bodyTextDe.addEventListener('keydown', handleEditorKeydown);

  const handleEditorPaste = (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          return; // Let image handler process image pasting
        }
      }
    }
    
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    
    const paragraphs = text.split(/\r?\n/);
    const container = document.createDocumentFragment();
    
    let lastPNode = null;
    paragraphs.forEach(p => {
      const trimmed = p.trim();
      if (trimmed !== '') {
        const pNode = document.createElement('p');
        pNode.textContent = trimmed;
        container.appendChild(pNode);
        lastPNode = pNode;
      }
    });
    
    if (!lastPNode) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    range.insertNode(container);
    
    const newRange = document.createRange();
    newRange.setStartAfter(lastPNode);
    newRange.setEndAfter(lastPNode);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    e.currentTarget.dispatchEvent(new Event('input'));
  };

  bodyTextEn.addEventListener('paste', handleEditorPaste);
  bodyTextDe.addEventListener('paste', handleEditorPaste);

  // WYSIWYG input change listeners
  bodyTextEn.addEventListener('input', () => {
    charCountEnLabel.textContent = `${bodyTextEn.textContent.length} characters`;
    englishIsModifiedSinceLastTranslation = true;
  });
  
  bodyTextEn.addEventListener('blur', () => {
    const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
    const newContent = serializeContent(bodyTextEn);
    if (JSON.stringify(artEn.content) !== JSON.stringify(newContent)) {
      saveHistoryState();
      artEn.content = newContent;
      updateHistoryButtons();
    }
  });

  bodyTextDe.addEventListener('input', () => {
    charCountDeLabel.textContent = `${bodyTextDe.textContent.length} characters`;
  });
  
  bodyTextDe.addEventListener('blur', () => {
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    const newContent = serializeContent(bodyTextDe);
    if (JSON.stringify(artDe.content) !== JSON.stringify(newContent)) {
      saveHistoryState();
      artDe.content = newContent;
      updateHistoryButtons();
    }
  });

  // Formatting Toolbars bindings (executing document formats)
  document.querySelectorAll('#toolbar-en .toolbar-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Keep focus inside editor
    });
    btn.addEventListener('click', () => {
      executeFormat(btn.getAttribute('data-cmd'));
      bodyTextEn.dispatchEvent(new Event('input'));
    });
  });
  
  document.querySelectorAll('#toolbar-de .toolbar-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Keep focus inside editor
    });
    btn.addEventListener('click', () => {
      executeFormat(btn.getAttribute('data-cmd'));
      bodyTextDe.dispatchEvent(new Event('input'));
    });
  });

  // Undo/Redo Click
  elBtnUndo.addEventListener('click', triggerUndo);
  elBtnRedo.addEventListener('click', triggerRedo);
  
  // Save CMS
  elBtnSave.addEventListener('click', handleSaveClick);
  
  // Publish CMS
  elBtnPublish.addEventListener('click', handlePublishClick);
  elBtnPublishClose.addEventListener('click', () => elPublishModal.classList.remove('open'));
  elBtnPublishCancel.addEventListener('click', () => elPublishModal.classList.remove('open'));
  elBtnPublishConfirm.addEventListener('click', executePublish);

  // Preview CMS
  if (elBtnPreview) {
    elBtnPreview.addEventListener('click', () => {
      if (!currentArticleId) {
        showToast('Please select or create an article first.', 'error');
        return;
      }
      elPreviewModal.classList.add('open');
    });
  }
  if (elBtnPreviewClose) {
    elBtnPreviewClose.addEventListener('click', () => elPreviewModal.classList.remove('open'));
  }
  if (elBtnPreviewCancel) {
    elBtnPreviewCancel.addEventListener('click', () => elPreviewModal.classList.remove('open'));
  }
  if (elBtnPreviewEn) {
    elBtnPreviewEn.addEventListener('click', () => triggerPreview('en'));
  }
  if (elBtnPreviewDe) {
    elBtnPreviewDe.addEventListener('click', () => triggerPreview('de'));
  }
  
  // Translate Button
  btnTranslate.addEventListener('click', executeTranslation);
  
  // Field-specific Translate Buttons
  if (elBtnTranslateTitle) {
    elBtnTranslateTitle.addEventListener('click', () => {
      translateField(elTitleEn, elTitleDe, elBtnTranslateTitle, 'Title');
    });
  }
  if (elBtnTranslateKeywords) {
    elBtnTranslateKeywords.addEventListener('click', () => {
      translateField(elKeywordsEn, elKeywordsDe, elBtnTranslateKeywords, 'Keywords');
    });
  }
  if (elBtnTranslateAbstract) {
    elBtnTranslateAbstract.addEventListener('click', () => {
      translateField(elAbstractEn, elAbstractDe, elBtnTranslateAbstract, 'Abstract');
    });
  }
  
  // Toggle Publish Status Button
  if (elBtnTogglePublish) {
    elBtnTogglePublish.addEventListener('click', () => {
      const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
      const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
      if (!artEn || !artDe) return;
      
      saveHistoryState();
      
      const isCurrentlyPublished = artEn.published !== false;
      const nextPublishedState = !isCurrentlyPublished;
      
      artEn.published = nextPublishedState;
      artDe.published = nextPublishedState;
      
      updateArticleStatusUI(nextPublishedState);
      renderSidebar();
      
      showToast(nextPublishedState ? 'Article set to Published!' : 'Article set to Draft (Unpublished)!', 'success');
    });
  }
  
  // Live Image Reload Preview
  elBtnReloadImage.addEventListener('click', () => {
    const val = elImage.value.trim();
    if (val) {
      checkAndProcessNewImage(resolveImagePath(val));
    } else {
      updateCoverImagePreview('');
    }
  });

  // AI Assist button click listeners
  elBtnAiAssistEn.addEventListener('click', () => openAiModal('en'));
  elBtnAiAssistDe.addEventListener('click', () => openAiModal('de'));
  
  // AI Assist actions
  elBtnAiClose.addEventListener('click', closeAiModal);
  elBtnAiCancel.addEventListener('click', closeAiModal);
  elBtnAiGenerate.addEventListener('click', generateAiSuggestion);
  elBtnAiApply.addEventListener('click', applyAiSuggestion);

  // Cover Image Assistant modal triggers
  elBtnNewArticle.addEventListener('click', handleNewArticleClick);
  elBtnImageAi.addEventListener('click', () => openResizeModal());
  elBtnResizeClose.addEventListener('click', closeResizeModal);
  elBtnResizeCancel.addEventListener('click', closeResizeModal);
  elBtnResizeApply.addEventListener('click', applyResizeAndSave);
  elBtnResizeBack.addEventListener('click', () => openResizeModal());
  elBtnResizeSend.addEventListener('click', handleResizeChatSend);
  elResizeChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleResizeChatSend();
    }
  });

  // Import View Path Loader
  elBtnResizePathLoad.addEventListener('click', () => {
    const val = elResizePathInput.value.trim();
    if (val) {
      checkAndProcessNewImage(resolveImagePath(val));
    } else {
      showToast("Please enter a path or web URL first.", "warning");
    }
  });

  elResizePathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = elResizePathInput.value.trim();
      if (val) {
        checkAndProcessNewImage(resolveImagePath(val));
      }
    }
  });

  // Import View Standard File Selector input
  elResizeFileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.indexOf('image') !== -1) {
        const reader = new FileReader();
        reader.onload = () => {
          checkAndProcessNewImage(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        showToast("Selected file is not an image.", "error");
      }
    }
  });

  // Import View Drag & Drop zone listeners
  elResizeDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elResizeDropZone.classList.add('dragover');
  });
  
  elResizeDropZone.addEventListener('dragleave', () => {
    elResizeDropZone.classList.remove('dragover');
  });
  
  elResizeDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elResizeDropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.indexOf('image') !== -1) {
        const reader = new FileReader();
        reader.onload = () => {
          checkAndProcessNewImage(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        showToast("Dropped file is not an image.", "error");
      }
    } else {
      const text = e.dataTransfer.getData('text');
      if (text && text.trim()) {
        checkAndProcessNewImage(resolveImagePath(text.trim()));
      }
    }
  });

  // Clipboard paste inside the modal
  elResizeModal.addEventListener('paste', (e) => {
    // If the path input is focused, let text pasting happen naturally
    if (document.activeElement === elResizePathInput || document.activeElement === elResizeChatInput) {
      return;
    }
    
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          checkAndProcessNewImage(reader.result);
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        return;
      }
    }
  });

  // Sidebar Cover Image field change / paste / drag & drop events (shortcut integrations)
  elImage.addEventListener('change', () => {
    const val = elImage.value.trim();
    if (!val) {
      saveHistoryState();
      updateCoverImagePreview('');
      const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
      const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
      if (artEn) artEn.image = '';
      if (artDe) artDe.image = '';
      updateHistoryButtons();
      renderSidebar();
    } else {
      checkAndProcessNewImage(resolveImagePath(val));
    }
  });

  elImage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = elImage.value.trim();
      if (val) {
        checkAndProcessNewImage(resolveImagePath(val));
      }
    }
  });

  const handleImagePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          checkAndProcessNewImage(reader.result);
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        return;
      }
    }
    
    // Handle URL or file path string paste
    const text = (e.clipboardData || e.originalEvent.clipboardData).getData('text');
    if (text && text.trim()) {
      const val = text.trim();
      if (e.currentTarget === elImage || e.currentTarget === elResizePathInput) {
        setTimeout(() => {
          checkAndProcessNewImage(resolveImagePath(e.currentTarget.value));
        }, 50);
      } else {
        checkAndProcessNewImage(resolveImagePath(val));
        e.preventDefault();
      }
    }
  };

  elImage.addEventListener('paste', handleImagePaste);
  
  const previewContainer = document.querySelector('.image-preview-container');
  if (previewContainer) {
    previewContainer.addEventListener('paste', handleImagePaste);
    
    previewContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      previewContainer.classList.add('dragover');
    });
    
    previewContainer.addEventListener('dragleave', () => {
      previewContainer.classList.remove('dragover');
    });
    
    previewContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      previewContainer.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.indexOf('image') !== -1) {
          const reader = new FileReader();
          reader.onload = () => {
            checkAndProcessNewImage(reader.result);
          };
          reader.readAsDataURL(file);
        } else {
          showToast("Dropped file is not an image.", "error");
        }
      } else {
        const text = e.dataTransfer.getData('text');
        if (text && text.trim()) {
          checkAndProcessNewImage(resolveImagePath(text.trim()));
        }
      }
    });
  }

  // Confirm Save Modal actions
  elBtnConfirmClose.addEventListener('click', () => elConfirmModal.classList.remove('open'));
  elBtnConfirmCancel.addEventListener('click', () => elConfirmModal.classList.remove('open'));
  
  elBtnConfirmNo.addEventListener('click', async () => {
    elConfirmModal.classList.remove('open');
    await saveAllChanges();
  });
  
  elBtnConfirmYes.addEventListener('click', async () => {
    elConfirmModal.classList.remove('open');
    const success = await executeTranslation();
    if (success) {
      await saveAllChanges();
    }
  });

  // Bind static metadata forms
  elTitleEn.addEventListener('change', async () => {
    saveHistoryState();
    
    const artEn = blogData.en.articles.find(a => a.id === currentArticleId);
    const artDe = blogData.de.articles.find(a => a.id === currentArticleId);
    if (!artEn || !artDe) return;
    
    const oldId = currentArticleId;
    const newTitle = elTitleEn.value.trim();
    artEn.title = newTitle;
    
    // Generate new ID if title changed
    const baseNewId = slugify(newTitle) || 'untitled-post';
    let uniqueNewId = baseNewId;
    let counter = 1;
    while (blogData.en.articles.some(a => a.id === uniqueNewId && a.id !== oldId)) {
      uniqueNewId = `${baseNewId}-${counter}`;
      counter++;
    }
    
    if (uniqueNewId !== oldId) {
      // 1. Ask backend to rename the cover image asset file if it exists
      try {
        const response = await fetch('/api/rename-article', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ oldId, newId: uniqueNewId })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.imagePath) {
            // Update the image path if it was renamed
            artEn.image = data.imagePath;
            artDe.image = data.imagePath;
            elImage.value = data.imagePath;
            updateCoverImagePreview(resolveImagePath(data.imagePath));
          }
        }
      } catch (err) {
        console.error("Failed to rename article assets:", err);
      }
      
      // 2. Update IDs in blogData
      artEn.id = uniqueNewId;
      artDe.id = uniqueNewId;
      currentArticleId = uniqueNewId;
      document.getElementById('meta-article-id').textContent = `ID: ${uniqueNewId}`;
    }
    
    updateHistoryButtons();
    renderSidebar();
  });
  bindInputSync(elTitleDe, 'title', false, true);
  bindInputSync(elDate, 'date', false, false);
  bindInputSync(elReadTime, 'readTime', false, false);
  bindInputSync(elAuthor, 'author', false, false);
  bindInputSync(elKeywordsEn, 'keywords', true, false);
  bindInputSync(elKeywordsDe, 'keywords', true, true);
  bindInputSync(elAbstractEn, 'abstract', false, false);
  bindInputSync(elAbstractDe, 'abstract', false, true);
  
  // Hotkeys (Ctrl+Z and Ctrl+Y)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      triggerUndo();
    }
    if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      triggerRedo();
    }
  });
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadBlogData();
  bindEvents();
});
