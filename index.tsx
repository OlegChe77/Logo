/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";

// DOM Element retrieval with type assertions
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const negativePromptInput = document.getElementById('negative-prompt-input') as HTMLTextAreaElement;
const styleButtons = document.querySelectorAll('.style-btn:not(.aspect-ratio-btn)') as NodeListOf<HTMLButtonElement>;
const aspectRatioButtons = document.querySelectorAll('.aspect-ratio-btn') as NodeListOf<HTMLButtonElement>;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const resultWrapper = document.getElementById('result-wrapper') as HTMLDivElement;
const logoImage = document.getElementById('logo-image') as HTMLImageElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const resultPlaceholder = document.getElementById('result-placeholder') as HTMLDivElement;
const mockupBtn = document.getElementById('mockup-btn') as HTMLButtonElement;
const mockupModal = document.getElementById('mockup-modal') as HTMLDivElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
const modalDescription = document.getElementById('modal-description') as HTMLParagraphElement;
const mockupViewer = document.getElementById('mockup-viewer') as HTMLDivElement;
const mockupNav = document.getElementById('mockup-nav') as HTMLDivElement;
const mockupPrevBtn = document.getElementById('mockup-prev-btn') as HTMLButtonElement;
const mockupNextBtn = document.getElementById('mockup-next-btn') as HTMLButtonElement;
const mockupCounter = document.getElementById('mockup-counter') as HTMLSpanElement;
const historyPanel = document.getElementById('history-panel') as HTMLElement;
const historyGrid = document.getElementById('history-grid') as HTMLDivElement;
const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;

let selectedStyle = '';
let selectedAspectRatio = '';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MOCKUP_ITEMS: Record<string, string> = {
    'Футболка': 'a white t-shirt',
    'Кружка': 'a ceramic coffee mug',
    'Визитка': 'a professional business card',
    'Ручка': 'a sleek modern pen',
    'Баннер': 'a large storefront banner'
};

const HISTORY_KEY = 'logoGeneratorHistory';
let logoHistory: string[] = []; // Array of base64 data URLs
let mockupResults: HTMLDivElement[] = [];
let currentMockupIndex = 0;


/**
 * Handles the selection of a logo style.
 * @param {Event} e The click event.
 */
function handleStyleSelection(e: Event) {
    const target = e.currentTarget as HTMLButtonElement;
    styleButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
    });
    target.classList.add('active');
    target.setAttribute('aria-checked', 'true');
    selectedStyle = target.dataset.style || '';
}

/**
 * Handles the selection of an aspect ratio.
 * @param {Event} e The click event.
 */
function handleAspectRatioSelection(e: Event) {
    const target = e.currentTarget as HTMLButtonElement;
    aspectRatioButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
    });
    target.classList.add('active');
    target.setAttribute('aria-checked', 'true');
    selectedAspectRatio = target.dataset.ratio || '';
}

/**
 * Sets the UI to a loading state.
 * @param {boolean} isLoading True to show loader, false to hide.
 */
function setLoading(isLoading: boolean) {
    errorMessage.textContent = '';
    if (isLoading) {
        generateBtn.disabled = true;
        resetBtn.disabled = true;
        generateBtn.textContent = 'Генерация...';
        loader.classList.remove('hidden');
        resultPlaceholder.classList.add('hidden');
        resultWrapper.classList.add('hidden');
    } else {
        generateBtn.disabled = false;
        resetBtn.disabled = false;
        generateBtn.textContent = 'Сгенерировать';
        loader.classList.add('hidden');
    }
}

/**
 * Displays an error message to the user.
 * @param {string} message The error message to display.
 */
function displayError(message: string) {
    resultWrapper.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
    errorMessage.textContent = message;
}

/**
 * Parses an error object and returns a user-friendly message.
 * @param error The error object from a catch block.
 * @returns An object with a title and details for the error.
 */
function getFriendlyErrorMessage(error: any): { title: string; details: string } {
    console.error('API Error:', error);
    const defaultMessage = {
        title: 'Ошибка генерации',
        details: 'Произошла непредвиденная ошибка. Пожалуйста, проверьте ваше соединение и попробуйте упростить запрос или повторить попытку позже.'
    };

    const errorMessageString = (typeof error === 'object' && error !== null) 
        ? error.message || JSON.stringify(error) 
        : String(error);

    if (errorMessageString.includes('429') || errorMessageString.includes('RESOURCE_EXHAUSTED')) {
        return {
            title: 'Лимит исчерпан',
            details: 'Превышен лимит запросов к API. Пожалуйста, проверьте ваш тарифный план или попробуйте снова позже (например, на следующий день).'
        };
    }

    if (errorMessageString.includes('SAFETY')) {
        return {
            title: 'Запрос отклонен',
            details: 'Ваш запрос был отклонен из-за правил безопасности. Пожалуйста, попробуйте переформулировать описание.'
        };
    }

    return defaultMessage;
}


/**
 * Downloads the generated logo image.
 */
function downloadLogo() {
    if (!logoImage.src || logoImage.src.startsWith('http')) {
        return; // Don't download if there's no src or it's not a data URL
    }
    const link = document.createElement('a');
    link.href = logoImage.src;
    link.download = 'logo-generated.jpeg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Loads logo history from localStorage.
 */
function loadHistory() {
    const storedHistory = localStorage.getItem(HISTORY_KEY);
    if (storedHistory) {
        logoHistory = JSON.parse(storedHistory);
    }
}

/**
 * Saves the current logo history to localStorage.
 */
function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(logoHistory));
}

/**
 * Handles a click on a history item, loading it into the main view.
 * @param {string} imageDataUrl The data URL of the clicked image.
 */
function handleHistoryClick(imageDataUrl: string) {
    errorMessage.textContent = '';
    loader.classList.add('hidden');
    logoImage.src = imageDataUrl;
    resultWrapper.classList.remove('hidden');
    resultPlaceholder.classList.add('hidden');
    setLoading(false); // Reset button states
}

/**
 * Renders the history items in the grid.
 */
function renderHistory() {
    historyGrid.innerHTML = '';
    if (logoHistory.length > 0) {
        historyPanel.classList.remove('hidden');
        logoHistory.forEach(imageDataUrl => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.style.backgroundImage = `url(${imageDataUrl})`;
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', 'Загрузить этот логотип из истории');
            item.addEventListener('click', () => handleHistoryClick(imageDataUrl));
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleHistoryClick(imageDataUrl);
                }
            });
            historyGrid.appendChild(item);
        });
    } else {
        historyPanel.classList.add('hidden');
    }
}

/**
 * Adds a new logo to the history.
 * @param {string} imageDataUrl The data URL of the new logo.
 */
function addToHistory(imageDataUrl: string) {
    // Avoid adding duplicates
    if (logoHistory.includes(imageDataUrl)) {
        return;
    }
    logoHistory.unshift(imageDataUrl); // Add to the beginning
    // Optional: limit history size to 20 items
    if (logoHistory.length > 20) {
        logoHistory.pop();
    }
    saveHistory();
    renderHistory();
}

/**
 * Clears the entire logo generation history.
 */
function clearHistory() {
    logoHistory = [];
    saveHistory();
    renderHistory();
}


/**
 * Main function to generate the logo.
 */
async function generateLogo() {
    const promptText = promptInput.value.trim();
    const negativePromptText = negativePromptInput.value.trim();

    if (!promptText) {
        displayError('Пожалуйста, введите описание для вашего логотипа.');
        return;
    }
    if (!selectedStyle) {
        displayError('Пожалуйста, выберите стиль для вашего логотипа.');
        return;
    }
    if (!selectedAspectRatio) {
        displayError('Пожалуйста, выберите соотношение сторон.');
        return;
    }

    setLoading(true);

    let finalPrompt = `Логотип для "${promptText}", стиль: ${selectedStyle}, соотношение сторон ${selectedAspectRatio}. Векторный, минималистичный дизайн, высокое разрешение, на чистом белом фоне.`;
    if (negativePromptText) {
        finalPrompt += ` Исключить следующие элементы: ${negativePromptText}.`;
    }
    
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: selectedAspectRatio as '1:1' | '16:9' | '9:16',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageDataUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
            logoImage.src = imageDataUrl;
            resultWrapper.classList.remove('hidden');
            resultPlaceholder.classList.add('hidden');
            addToHistory(imageDataUrl);
        } else {
            displayError('Не удалось сгенерировать изображение. Возможно, ваш запрос был слишком сложным или был отклонен из-за правил безопасности. Попробуйте переформулировать описание.');
        }
    } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        displayError(friendlyError.details);
    } finally {
        setLoading(false);
    }
}

/** Opens the mockup modal. */
function openModal() {
    mockupModal.classList.remove('hidden');
}

/** Closes the mockup modal. */
function closeModal() {
    mockupModal.classList.add('hidden');
}

/**
 * Displays a specific mockup in the viewer.
 * @param index The index of the mockup to show.
 */
function showMockup(index: number) {
    if (index < 0 || index >= mockupResults.length) return;

    currentMockupIndex = index;
    mockupViewer.innerHTML = '';
    mockupViewer.appendChild(mockupResults[index]);

    mockupCounter.textContent = `${index + 1} / ${mockupResults.length}`;
    mockupPrevBtn.disabled = index === 0;
    mockupNextBtn.disabled = index === mockupResults.length - 1;
}

/**
 * Generates a single mockup image and returns the container element.
 * @param name The name of the item.
 * @param context The context for the prompt (e.g., 'a white t-shirt').
 * @param base64Logo The base64 string of the logo to apply.
 * @returns {Promise<HTMLDivElement>} A promise that resolves to the mockup item container.
 */
async function generateSingleMockup(name: string, context: string, base64Logo: string): Promise<HTMLDivElement> {
    const mockupItemContainer = document.createElement('div');
    mockupItemContainer.className = 'mockup-item';

    const mockupPrompt = `Realistically place this logo onto ${context}. The logo should be clearly visible and well-integrated.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Logo,
                            mimeType: 'image/jpeg',
                        },
                    },
                    {
                        text: mockupPrompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart && imagePart.inlineData) {
            const base64ImageBytes = imagePart.inlineData.data;
            mockupItemContainer.innerHTML = `
                <img src="data:image/jpeg;base64,${base64ImageBytes}" alt="Логотип на ${name}">
                <p class="mockup-title">${name}</p>
            `;
        } else {
            throw new Error('API returned no image for mockup.');
        }
    } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        mockupItemContainer.innerHTML = `
            <div class="mockup-error">
                <p>${friendlyError.title}</p>
                <p class="mockup-error-details">${friendlyError.details}</p>
            </div>
            <p class="mockup-title">${name}</p>
        `;
    }
    return mockupItemContainer;
}

/**
 * Generates all mockups sequentially and displays them in the modal carousel.
 */
async function generateMockups() {
    if (!logoImage.src || logoImage.src.startsWith('http')) {
        return; // Safeguard: no logo to work with
    }
    
    mockupBtn.disabled = true;
    mockupBtn.textContent = 'Создаем примеры...';
    mockupResults = [];
    currentMockupIndex = 0;

    openModal();
    mockupNav.classList.add('hidden');
    mockupViewer.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
    modalDescription.textContent = 'Генерация примеров... Это может занять несколько минут.';

    const base64Logo = logoImage.src.split(',')[1];
    if (!base64Logo) {
        closeModal();
        mockupBtn.disabled = false;
        mockupBtn.textContent = 'Примерить на предметах';
        console.error("Could not extract base64 data from logo image.");
        return;
    }

    try {
        const items = Object.entries(MOCKUP_ITEMS);
        for (let i = 0; i < items.length; i++) {
            const [name, context] = items[i];
            modalDescription.textContent = `Генерация... (${i + 1} / ${items.length}): ${name}`;
            const mockupElement = await generateSingleMockup(name, context, base64Logo);
            mockupResults.push(mockupElement);
        }

        modalDescription.textContent = 'Посмотрите, как ваш логотип будет выглядеть в реальной жизни.';
        mockupNav.classList.remove('hidden');
        showMockup(0);

    } finally {
        mockupBtn.disabled = false;
        mockupBtn.textContent = 'Примерить на предметах';
    }
}

/**
 * Resets the entire UI to its initial state.
 */
function resetUI() {
    promptInput.value = '';
    negativePromptInput.value = '';

    // Reset style selection to default
    styleButtons.forEach(btn => btn.classList.remove('active'));
    if (styleButtons.length > 0) {
        styleButtons[0].click();
    }

    // Reset aspect ratio selection to default
    aspectRatioButtons.forEach(btn => btn.classList.remove('active'));
    if (aspectRatioButtons.length > 0) {
        aspectRatioButtons[0].click();
    }

    // Reset result area
    resultWrapper.classList.add('hidden');
    loader.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
    logoImage.src = '';
    errorMessage.textContent = '';
    
    // Reset button states
    generateBtn.disabled = false;
    generateBtn.textContent = 'Сгенерировать';
    mockupBtn.disabled = false;
    mockupBtn.textContent = 'Примерить на предметах';
}

/**
 * Initializes the application, sets up event listeners.
 */
function initializeApp() {
    styleButtons.forEach(button => {
        button.addEventListener('click', handleStyleSelection);
    });

    aspectRatioButtons.forEach(button => {
        button.addEventListener('click', handleAspectRatioSelection);
    });

    generateBtn.addEventListener('click', generateLogo);
    
    resetBtn.addEventListener('click', resetUI);

    downloadBtn.addEventListener('click', downloadLogo);

    mockupBtn.addEventListener('click', generateMockups);

    modalCloseBtn.addEventListener('click', closeModal);
    
    clearHistoryBtn.addEventListener('click', clearHistory);

    mockupModal.addEventListener('click', (e) => {
        if (e.target === mockupModal) {
            closeModal();
        }
    });

    mockupPrevBtn.addEventListener('click', () => {
        if (currentMockupIndex > 0) {
            showMockup(currentMockupIndex - 1);
        }
    });

    mockupNextBtn.addEventListener('click', () => {
        if (currentMockupIndex < mockupResults.length - 1) {
            showMockup(currentMockupIndex + 1);
        }
    });
    
    // Set initial state
    resetUI();
    loadHistory();
    renderHistory();
}

// Run the app
initializeApp();