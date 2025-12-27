/**
 * Article Popup Component
 * Displays article details (text, image, video) in a non-modal popup
 */

import { fetchArticleById } from './api.js';

// Popup state
let popupElement = null;
let isLoading = false;

/**
 * Convert a WebHDFS URL to use the local proxy to avoid CORS issues
 * e.g., http://localhost:9870/webhdfs/v1/articles/... -> /hdfs/articles/...
 */
function toProxyUrl(hdfsUrl) {
    if (!hdfsUrl) return null;
    // Match WebHDFS URLs and convert to proxy path
    const match = hdfsUrl.match(/https?:\/\/[^/]+\/webhdfs\/v1(\/.*)/);
    if (match) {
        return '/hdfs' + match[1];
    }
    return hdfsUrl;
}

/**
 * Fetch a single article by database ID
 * Uses GET /articles/:id endpoint which benefits from Redis caching
 */
async function fetchArticle(id) {
    const article = await fetchArticleById(id);
    
    if (!article) {
        throw new Error(`Article not found: ${id}`);
    }
    
    return article;
}

/**
 * Create the popup DOM element if it doesn't exist
 */
function ensurePopupElement() {
    if (popupElement) return popupElement;
    
    popupElement = document.createElement('div');
    popupElement.id = 'article-popup-overlay';
    popupElement.className = 'article-popup-overlay';
    popupElement.innerHTML = `
        <div class="article-popup" onclick="event.stopPropagation()">
            <div class="article-popup-header">
                <h2 class="article-popup-title"></h2>
                <button class="article-popup-close" onclick="window.closeArticlePopup()">&times;</button>
            </div>
            <div class="article-popup-content">
                <div class="article-popup-loading">Loading article...</div>
                <div class="article-popup-error" style="display: none;"></div>
                <div class="article-popup-body" style="display: none;">
                    <div class="article-popup-meta">
                        <span class="article-popup-category"></span>
                        <span class="article-popup-aid"></span>
                        <span class="article-popup-language"></span>
                    </div>
                    <div class="article-popup-authors"></div>
                    <div class="article-popup-tags"></div>
                    <div class="article-popup-abstract"></div>
                    <div class="article-popup-media">
                        <div class="article-popup-image-container">
                            <h4>Image</h4>
                            <img class="article-popup-image" alt="Article image" />
                            <div class="article-popup-no-image">No image available</div>
                        </div>
                        <div class="article-popup-video-container">
                            <h4>Video</h4>
                            <video class="article-popup-video" controls></video>
                            <div class="article-popup-no-video">No video available</div>
                        </div>
                    </div>
                    <div class="article-popup-text-container">
                        <h4>Article Text</h4>
                        <div class="article-popup-text"></div>
                        <div class="article-popup-no-text">No text available</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Close on background click
    popupElement.addEventListener('click', (e) => {
        if (e.target === popupElement) {
            closeArticlePopup();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popupElement.classList.contains('visible')) {
            closeArticlePopup();
        }
    });
    
    document.body.appendChild(popupElement);
    return popupElement;
}

/**
 * Show the article popup for a given article ID
 * @param {number} id - The database ID of the article
 * @param {string} aid - The article ID string (e.g., "a123") for display purposes
 */
export async function showArticlePopup(id, aid) {
    if (isLoading) return;
    
    const popup = ensurePopupElement();
    const loading = popup.querySelector('.article-popup-loading');
    const error = popup.querySelector('.article-popup-error');
    const body = popup.querySelector('.article-popup-body');
    const title = popup.querySelector('.article-popup-title');
    
    // Reset state
    loading.style.display = 'block';
    error.style.display = 'none';
    body.style.display = 'none';
    title.textContent = `Article: ${aid || id}`;
    
    // Show popup
    popup.classList.add('visible');
    isLoading = true;
    
    try {
        const article = await fetchArticle(id);
        
        // Update title
        title.textContent = article.title || `Article: ${aid || id}`;
        
        // Update meta
        popup.querySelector('.article-popup-category').textContent = article.category || 'Unknown';
        popup.querySelector('.article-popup-aid').textContent = `ID: ${article.aid}`;
        popup.querySelector('.article-popup-language').textContent = article.language === 'zh' ? '中文' : 'English';
        
        // Authors
        const authorsEl = popup.querySelector('.article-popup-authors');
        if (article.authors && article.authors.length > 0) {
            authorsEl.textContent = `By: ${article.authors.join(', ')}`;
            authorsEl.style.display = 'block';
        } else {
            authorsEl.style.display = 'none';
        }
        
        // Tags
        const tagsEl = popup.querySelector('.article-popup-tags');
        if (article.articleTags && article.articleTags.length > 0) {
            tagsEl.innerHTML = article.articleTags.map(tag => `<span class="article-tag">${tag}</span>`).join('');
            tagsEl.style.display = 'block';
        } else {
            tagsEl.style.display = 'none';
        }
        
        // Abstract
        const abstractEl = popup.querySelector('.article-popup-abstract');
        if (article.abstract) {
            abstractEl.textContent = article.abstract;
            abstractEl.style.display = 'block';
        } else {
            abstractEl.style.display = 'none';
        }
        
        // Image
        const imageEl = popup.querySelector('.article-popup-image');
        const noImageEl = popup.querySelector('.article-popup-no-image');
        const imageProxyUrl = toProxyUrl(article.imageUrl);
        if (imageProxyUrl) {
            imageEl.src = imageProxyUrl;
            imageEl.style.display = 'block';
            noImageEl.style.display = 'none';
            imageEl.onerror = () => {
                imageEl.style.display = 'none';
                noImageEl.style.display = 'block';
            };
        } else {
            imageEl.style.display = 'none';
            noImageEl.style.display = 'block';
        }
        
        // Video
        const videoEl = popup.querySelector('.article-popup-video');
        const noVideoEl = popup.querySelector('.article-popup-no-video');
        const videoProxyUrl = toProxyUrl(article.videoUrl);
        if (videoProxyUrl) {
            videoEl.src = videoProxyUrl;
            videoEl.style.display = 'block';
            noVideoEl.style.display = 'none';
            videoEl.onerror = () => {
                videoEl.style.display = 'none';
                noVideoEl.style.display = 'block';
            };
        } else {
            videoEl.style.display = 'none';
            noVideoEl.style.display = 'block';
        }
        
        // Text - fetch from URL if available
        const textEl = popup.querySelector('.article-popup-text');
        const noTextEl = popup.querySelector('.article-popup-no-text');
        const textProxyUrl = toProxyUrl(article.textUrl);
        if (textProxyUrl) {
            textEl.textContent = 'Loading text...';
            textEl.style.display = 'block';
            noTextEl.style.display = 'none';
            
            try {
                const textResponse = await fetch(textProxyUrl);
                if (textResponse.ok) {
                    const text = await textResponse.text();
                    textEl.textContent = text;
                } else {
                    textEl.textContent = 'Failed to load text';
                }
            } catch (err) {
                textEl.textContent = `Error loading text: ${err.message}`;
            }
        } else {
            textEl.style.display = 'none';
            noTextEl.style.display = 'block';
        }
        
        // Show body, hide loading
        loading.style.display = 'none';
        body.style.display = 'block';
        
    } catch (err) {
        console.error('Failed to load article:', err);
        loading.style.display = 'none';
        error.textContent = `Error: ${err.message}`;
        error.style.display = 'block';
    } finally {
        isLoading = false;
    }
}

/**
 * Close the article popup
 */
function closeArticlePopup() {
    if (popupElement) {
        popupElement.classList.remove('visible');
        
        // Stop video playback
        const video = popupElement.querySelector('.article-popup-video');
        if (video) {
            video.pause();
            video.src = '';
        }
    }
}

// Export for global access (used by onclick handlers in AG Grid cell renderers)
window.showArticlePopup = showArticlePopup;
window.closeArticlePopup = closeArticlePopup;
