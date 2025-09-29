/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";

// DOM Element retrieval with type assertions
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const styleButtons = document.querySelectorAll('.style-btn:not(.format-btn)') as NodeListOf<HTMLButtonElement>;
const formatButtons = document.querySelectorAll('.format-btn') as NodeListOf<HTMLButtonElement>;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const loaderMessage = document.getElementById('loader-message') as HTMLParagraphElement;
const resultWrapper = document.getElementById('result-wrapper') as HTMLDivElement;
const logoImage = document.getElementById('logo-image') as HTMLImageElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
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
const historyGrid = document.getElementById('history-grid') as HTMLDivElement;
const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn') as HTMLButtonElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const saveApiKeyBtn = document.getElementById('save-api-key-btn') as HTMLButtonElement;
const clearApiKeyBtn = document.getElementById('clear-api-key-btn') as HTMLButtonElement;
const apiStatusIndicator = document.getElementById('api-status-indicator') as HTMLDivElement;
const restyleOverlay = document.getElementById('restyle-overlay') as HTMLDivElement;
const confirmModal = document.getElementById('confirm-modal') as HTMLDivElement;
const confirmMessage = document.getElementById('confirm-message') as HTMLParagraphElement;
const confirmBtnYes = document.getElementById('confirm-btn-yes') as HTMLButtonElement;
const confirmBtnNo = document.getElementById('confirm-btn-no') as HTMLButtonElement;
const referenceUploadArea = document.getElementById('reference-upload-area') as HTMLDivElement;
const referenceInput = document.getElementById('reference-input') as HTMLInputElement;
const thumbnailsContainer = document.getElementById('thumbnails-container') as HTMLDivElement;
const colorInput = document.getElementById('color-input') as HTMLInputElement;

// Tab elements
const tabGeneratorBtn = document.getElementById('tab-generator') as HTMLButtonElement;
const tabHistoryBtn = document.getElementById('tab-history') as HTMLButtonElement;
const historyCountSpan = document.getElementById('history-count') as HTMLSpanElement;
const panelGenerator = document.getElementById('panel-generator') as HTMLDivElement;
const panelHistory = document.getElementById('panel-history') as HTMLDivElement;
const noHistoryMessage = document.getElementById('no-history-message') as HTMLDivElement;

interface LogoData {
    prompt: string;
    dataUrl: string;
}

interface ReferenceImage {
    id: string;
    mimeType: string;
    data: string; // base64 data without prefix
    dataUrl: string; // full data URL for display
}

let selectedStyle = '';
let selectedFormat = '';
let referenceImages: ReferenceImage[] = [];

let ai: GoogleGenAI | null = null;
const USER_API_KEY_KEY = 'userGeminiApiKey';

const MOCKUP_ITEMS: Record<string, string> = {
    'Футболка': 'белую футболку',
    'Кружка': 'керамическую кофейную кружку',
    'Визитка': 'профессиональную визитную карточку',
    'Ручка': 'стильную современную ручку',
    'Листовка': 'современную маркетинговую листовку',
    'Вывеска': 'элегантную вывеску на фасаде магазина'
};

const STYLE_PROMPTS: Record<string, string> = {
    '3D': 'Объемный 3D, с тенями, бликами и выраженной глубиной',
};


const HISTORY_KEY = 'logoGeneratorHistory';
let logoHistory: LogoData[] = [];
let mockupResults: HTMLDivElement[] = [];
let currentMockupIndex = 0;
let isAnimating = false;
let originalGenerationData: LogoData | null = null;
let confirmCallback: (() => void) | null = null;

/**
 * Shows a custom confirmation modal.
 * @param message The message to display in the modal.
 * @param onConfirm The callback function to execute if the user confirms.
 */
function showConfirmationModal(message: string, onConfirm: () => void) {
    confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.add('visible');
}

/** Closes the custom confirmation modal. */
function closeConfirmModal() {
    confirmModal.classList.remove('visible');
    confirmCallback = null;
}

/**
 * Switches the active tab in the UI.
 * @param {'generator' | 'history'} tabName The name of the tab to switch to.
 */
function switchTab(tabName: 'generator' | 'history') {
    if (tabName === 'generator') {
        panelGenerator.classList.add('active');
        panelHistory.classList.remove('active');
        tabGeneratorBtn.classList.add('active');
        tabHistoryBtn.classList.remove('active');
        tabGeneratorBtn.setAttribute('aria-selected', 'true');
        tabHistoryBtn.setAttribute('aria-selected', 'false');
    } else {
        panelGenerator.classList.remove('active');
        panelHistory.classList.add('active');
        tabGeneratorBtn.classList.remove('active');
        tabHistoryBtn.classList.add('active');
        tabGeneratorBtn.setAttribute('aria-selected', 'false');
        tabHistoryBtn.setAttribute('aria-selected', 'true');
        renderHistory(); // Re-render history when switching to its tab
    }
}

/**
 * Updates the API status indicator in the UI.
 */
function updateApiStatusIndicator() {
    const userKey = localStorage.getItem(USER_API_KEY_KEY);
    if (userKey) {
        apiStatusIndicator.textContent = 'Режим: Безлимитный (свой ключ)';
        apiStatusIndicator.classList.add('pro');
    } else {
        apiStatusIndicator.textContent = 'Режим: Бесплатный';
        apiStatusIndicator.classList.remove('pro');
    }
}

/**
 * Returns the active API key, preferring the user's key over the default.
 * @returns {string | undefined} The API key.
 */
function getApiKey(): string | undefined {
    return localStorage.getItem(USER_API_KEY_KEY) || process.env.API_KEY;
}

/**
 * Initializes the GoogleGenAI instance with the active API key.
 */
function initializeAi() {
    const apiKey = getApiKey();
    if (!apiKey) {
        ai = null;
        displayError(
            'API Ключ не найден',
            'Пожалуйста, добавьте ваш Gemini API ключ в настройках, чтобы начать генерацию.',
            true
        );
        generateBtn.disabled = true;
    } else {
        ai = new GoogleGenAI({ apiKey });
        if (resultPlaceholder.querySelector('.error-display')) {
            resetUI(true); // Force reset without confirm
        }
        generateBtn.disabled = false;
    }
    updateApiStatusIndicator();
}

/** Opens the settings modal. */
function openSettingsModal() {
    apiKeyInput.value = localStorage.getItem(USER_API_KEY_KEY) || '';
    settingsModal.classList.add('visible');
}

/** Closes the settings modal. */
function closeSettingsModal() {
    settingsModal.classList.remove('visible');
}

/** Saves the user's API key to localStorage and re-initializes the AI. */
function saveApiKey() {
    const userKey = apiKeyInput.value.trim();
    if (userKey) {
        localStorage.setItem(USER_API_KEY_KEY, userKey);
        initializeAi();
        closeSettingsModal();
    }
}

/** Clears the user's API key and reverts to the default key. */
function clearApiKey() {
    localStorage.removeItem(USER_API_KEY_KEY);
    apiKeyInput.value = '';
    initializeAi();
    closeSettingsModal();
}

/**
 * Enables or disables all style buttons.
 * @param {boolean} disabled True to disable, false to enable.
 */
function updateStyleButtonsState(disabled: boolean) {
    styleButtons.forEach(btn => {
        btn.disabled = disabled;
    });
}

/** Disables reference inputs after generation. */
function lockReferenceInputs() {
    referenceInput.disabled = true;
    colorInput.disabled = true;
    referenceUploadArea.classList.add('disabled');
    thumbnailsContainer.querySelectorAll('.thumbnail-remove').forEach(btn => {
        (btn as HTMLButtonElement).disabled = true;
    });
}

/** Enables reference inputs. */
function unlockReferenceInputs() {
    referenceInput.disabled = false;
    colorInput.disabled = false;
    referenceUploadArea.classList.remove('disabled');
}


/**
 * Disables all format buttons after a choice is made.
 */
function lockFormatSelection() {
    formatButtons.forEach(btn => {
        btn.disabled = true;
    });
}

/**
 * Enables all format buttons.
 */
function unlockFormatSelection() {
    formatButtons.forEach(btn => {
        btn.disabled = false;
    });
}


/**
 * Handles the selection of an output file format before generation.
 * This function is disabled after the first generation.
 * @param {Event} e The click event.
 */
function handleFormatSelection(e: Event) {
    // Do nothing if a logo has already been generated (format is locked) or button is disabled
    if (originalGenerationData || (e.currentTarget as HTMLButtonElement).disabled) {
        return;
    }

    const target = e.currentTarget as HTMLButtonElement;
    const newFormat = target.dataset.format || '';

    if (newFormat === selectedFormat) {
        return;
    }

    formatButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
    });
    target.classList.add('active');
    target.setAttribute('aria-checked', 'true');
    selectedFormat = newFormat;
}

/**
 * Sets the UI to a loading state for primary generation.
 * @param {boolean} isLoading True to show loader, false to hide.
 */
function setLoading(isLoading: boolean, message = 'Магия в процессе... Генерация может занять до минуты.') {
    loaderMessage.textContent = message;
    loader.classList.toggle('hidden', !isLoading);


    if (isLoading) {
        resultPlaceholder.innerHTML = '';
        resultPlaceholder.classList.add('hidden');
        resultWrapper.classList.add('hidden');
    }

    const controlsToDisable = [generateBtn, resetBtn, promptInput, ...Array.from(formatButtons), referenceInput, colorInput];
    controlsToDisable.forEach(control => {
        (control as HTMLInputElement | HTMLButtonElement).disabled = isLoading;
    });

    // Style buttons are handled separately
    updateStyleButtonsState(isLoading);

    // Actions on the result should be disabled
    mockupBtn.disabled = true;
    downloadBtn.disabled = true;
}


/**
 * Sets the UI to a loading state for restyling/conversion overlays.
 * @param {boolean} isProcessing True to show overlay, false to hide.
 * @param {string} text The text to display in the overlay.
 */
function setRestyling(isProcessing: boolean, text = 'Применяем новый стиль...') {
    const p = restyleOverlay.querySelector('p');
    if (p) {
        p.textContent = text;
    }
    restyleOverlay.classList.toggle('hidden', !isProcessing);

    // Disable controls during this process as well
    const controlsToDisable = [
        generateBtn, resetBtn, promptInput,
        ...Array.from(formatButtons), ...Array.from(styleButtons),
        downloadBtn, mockupBtn
    ];
    controlsToDisable.forEach(control => {
        (control as HTMLButtonElement).disabled = isProcessing;
    });
}

/**
 * Displays an error message in the result panel.
 * @param {string} title The main error title.
 * @param {string} details A more detailed explanation.
 * @param {boolean} showSettingsButton Whether to show a button to open settings.
 */
function displayError(title: string, details: string, showSettingsButton = false) {
    loader.classList.add('hidden');
    resultWrapper.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
    resultPlaceholder.innerHTML = `
        <div class="error-display">
            <h3>${title}</h3>
            <p>${details}</p>
            ${showSettingsButton ? '<button id="error-open-settings-btn">Добавить API-ключ</button>' : ''}
        </div>
    `;
    if (showSettingsButton) {
        document.getElementById('error-open-settings-btn')?.addEventListener('click', openSettingsModal);
    }
}

/**
 * Converts a technical error into a user-friendly message.
 * @param {unknown} error The error object.
 * @returns {{title: string, details: string, isQuotaError: boolean}} The friendly error message.
 */
function getFriendlyErrorMessage(error: unknown): { title: string; details: string; isQuotaError: boolean } {
    console.error(error);
    const genericMessage = 'Что-то пошло не так. Пожалуйста, попробуйте еще раз или упростите ваш запрос.';
    let isQuotaError = false;

    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
            isQuotaError = true;
            return {
                title: 'Превышен лимит запросов',
                details: 'Бесплатные попытки на сегодня закончились. Вы можете подождать до завтра или добавить свой собственный API ключ в настройках для продолжения без ограничений.',
                isQuotaError: true
            };
        }
        if (message.includes('API key not valid')) {
            return {
                title: 'Неверный API Ключ',
                details: 'Пожалуйста, проверьте правильность вашего API ключа в настройках.',
                isQuotaError: false
            };
        }
    }
    return { title: 'Произошла ошибка', details: genericMessage, isQuotaError: false };
}

/**
 * Displays the generated logo image.
 * @param {string} dataUrl The base64 data URL of the image.
 */
function displayLogo(dataUrl: string) {
    logoImage.src = dataUrl;
    resultWrapper.classList.remove('hidden');
    loader.classList.add('hidden');
    resultPlaceholder.classList.add('hidden');
    mockupBtn.disabled = false;
    downloadBtn.disabled = false;
    updateStyleButtonsState(false); // Enable style buttons
    generateBtn.textContent = 'Сгенерировать новый';
}

/**
 * Main function to generate a new logo from the prompt.
 */
async function generateLogo() {
    if (!ai) {
        displayError('API клиент не инициализирован.', 'Проверьте ваш API ключ в настройках.', true);
        return;
    }
    const prompt = promptInput.value.trim();
    if (!prompt) {
        displayError('Описание не может быть пустым', 'Пожалуйста, введите описание для вашего логотипа.');
        return;
    }

    if (!selectedStyle) {
        displayError('Стиль не выбран', 'Пожалуйста, выберите стиль для вашего логотипа.');
        return;
    }
    if (!selectedFormat) {
        displayError('Формат не выбран', 'Пожалуйста, выберите формат файла (JPEG или PNG).');
        return;
    }

    setLoading(true, 'Анализируем референсы...');
    let finalPrompt = '';

    try {
        const basePrompt = promptInput.value.trim();
        const colors = colorInput.value.trim();
        const styleForRequest = selectedStyle;
        const stylePrompt = STYLE_PROMPTS[styleForRequest] || styleForRequest;
        const backgroundPrompt = selectedFormat === 'image/png' ? 'с прозрачным фоном (transparent background)' : 'на чистом белом фоне';

        if (referenceImages.length > 0 || colors) {
            const visionPromptParts: any[] = [{ text: `Generate a detailed, creative prompt for an image generation AI. The goal is to create a logo for "${basePrompt}".` }];

            if (referenceImages.length > 0) {
                visionPromptParts.push({ text: "The logo should be heavily inspired by the following reference image(s) in terms of style, composition, and shapes:" });
                referenceImages.forEach(img => {
                    visionPromptParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                });
            }

            if (colors) {
                visionPromptParts.push({ text: `The desired color palette is: ${colors}.` });
            }

            visionPromptParts.push({ text: `The final logo should have a style of "${stylePrompt}" and be on a ${backgroundPrompt}. Combine all these instructions into a single, cohesive descriptive prompt for an image generation model.` });

            const visionResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: visionPromptParts },
            });
            finalPrompt = visionResponse.text;
        } else {
            finalPrompt = `Логотип для "${basePrompt}", стиль: ${stylePrompt}, ${backgroundPrompt}.`;
        }
        
        setLoading(true, 'Создаем ваш уникальный логотип...');

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: selectedFormat as 'image/jpeg' | 'image/png',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const dataUrl = `data:${selectedFormat};base64,${base64ImageBytes}`;
            originalGenerationData = { prompt, dataUrl };
            displayLogo(dataUrl);
            saveHistory(originalGenerationData);
            lockFormatSelection();
            lockReferenceInputs();
        } else {
            throw new Error('API did not return any images.');
        }
    } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        displayError(friendlyError.title, friendlyError.details, friendlyError.isQuotaError);
    } finally {
        setLoading(false);
    }
}

/**
 * Displays a temporary error message in the restyle overlay.
 * @param {string} message The error message to display.
 */
function handleRestyleError(message: string) {
    const p = restyleOverlay.querySelector('p');
    const spinner = restyleOverlay.querySelector('.spinner');

    if (p) p.textContent = message;
    if (spinner) (spinner as HTMLElement).style.display = 'none';

    setTimeout(() => {
        setRestyling(false); // Hides overlay, enables controls
        // Reset overlay content for the next run
        if (p) p.textContent = 'Применяем новый стиль...';
        if (spinner) (spinner as HTMLElement).style.display = 'block';
    }, 4000);
}


/**
 * Applies a new style to the original generated logo.
 * @param {string} style The new style to apply.
 */
async function restyleLogo(style: string) {
    if (!ai || !originalGenerationData) return;
    if (!restyleOverlay.classList.contains('hidden')) return;

    setRestyling(true);

    try {
        const { prompt, dataUrl } = originalGenerationData;
        const currentMimeType = dataUrl.split(':')[1].split(';')[0];
        const base64ImageData = dataUrl.split(',')[1];
        const stylePrompt = STYLE_PROMPTS[style] || style;
        const backgroundPrompt = currentMimeType === 'image/png' ? 'сохраняя прозрачный фон' : 'на чистом белом фоне';
        const instruction = `Перерисуй этот логотип в стиле "${stylePrompt}", ${backgroundPrompt}.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: currentMimeType, data: base64ImageData } },
                    { text: instruction },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData) {
            const newMimeType = imagePart.inlineData.mimeType;
            const newData = imagePart.inlineData.data;
            const newUrl = `data:${newMimeType};base64,${newData}`;
            displayLogo(newUrl); // Display the new styled logo
            saveHistory({ prompt, dataUrl: newUrl }); // Save the new version to history
            setRestyling(false);
        } else {
            const textResponse = response.text?.trim();
            const errorMessage = textResponse 
                ? `Не удалось применить стиль. Ответ модели: "${textResponse}"`
                : 'Не удалось применить стиль. ИИ не вернул изображение, возможно из-за фильтров безопасности.';
            handleRestyleError(errorMessage);
        }

    } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        handleRestyleError(`Ошибка: ${friendlyError.details}`);
    }
}


/** Downloads the currently displayed logo. */
function downloadLogo() {
    const dataUrl = logoImage.src;
    if (!dataUrl || dataUrl.startsWith('http')) return;

    const mimeType = dataUrl.split(':')[1].split(';')[0];
    const extension = mimeType === 'image/png' ? 'png' : 'jpeg';

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `logo-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


/**
 * Generates a single mockup image.
 * @param {string} logoDataUrl The base64 data URL of the logo.
 * @param {string} itemName The name of the item (e.g., 'Футболка').
 * @param {string} itemDescription The description for the prompt (e.g., 'белую футболку').
 * @returns {Promise<HTMLDivElement>} A promise that resolves to the mockup element.
 */
async function generateSingleMockup(logoDataUrl: string, itemName: string, itemDescription: string): Promise<HTMLDivElement> {
    const mockupItem = document.createElement('div');
    mockupItem.className = 'mockup-item';
    mockupItem.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div><div class="mockup-title">${itemName}</div>`;

    if (!ai) {
        mockupItem.innerHTML = `<div class="mockup-error"><p>Ошибка</p><p class="mockup-error-details">Клиент API не инициализирован.</p></div><div class="mockup-title">${itemName}</div>`;
        return mockupItem;
    }

    try {
        const mimeType = logoDataUrl.split(':')[1].split(';')[0];
        const base64ImageData = logoDataUrl.split(',')[1];

        let instruction = `Создай фотореалистичный мокап, разместив этот логотип на ${itemDescription}. Учти материал, текстуру и освещение объекта для естественной интеграции.`;
        if (itemName === 'Ручка') {
            instruction = `Создай креативный фотореалистичный мокап, разместив этот логотип на ${itemDescription}. Можно изящно выгравировать его на клипсе или нанести на корпус.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: instruction },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData) {
            const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            mockupItem.innerHTML = `<img src="${dataUrl}" alt="Мокап логотипа на ${itemName}"><div class="mockup-title">${itemName}</div>`;
        } else {
            throw new Error(`API returned no image for ${itemName}`);
        }
    } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        mockupItem.innerHTML = `<div class="mockup-error"><p>${friendlyError.title}</p><p class="mockup-error-details">${friendlyError.details}</p></div><div class="mockup-title">${itemName}</div>`;
    }
    return mockupItem;
}

/** Asynchronously generates all mockups and displays them in a carousel. */
async function generateMockups() {
    if (!logoImage.src || logoImage.src.startsWith('http')) return;

    openMockupModal();
    mockupResults = [];
    currentMockupIndex = 0;
    mockupViewer.innerHTML = '';
    mockupNav.classList.add('hidden');

    const itemEntries = Object.entries(MOCKUP_ITEMS);

    for (let i = 0; i < itemEntries.length; i++) {
        const [name, description] = itemEntries[i];
        modalDescription.textContent = `Генерация примера... (${i + 1} / ${itemEntries.length})`;
        const mockupElement = await generateSingleMockup(logoImage.src, name, description);
        mockupResults.push(mockupElement);
    }

    modalDescription.textContent = 'Посмотрите, как ваш логотип будет выглядеть в реальной жизни.';

    if (mockupResults.length > 0) {
        showMockup(0);
        mockupNav.classList.remove('hidden');
    }
}

/**
 * Displays a specific mockup in the viewer.
 * @param {number} index The index of the mockup to show.
 */
async function showMockup(index: number) {
    if (isAnimating || index < 0 || index >= mockupResults.length) return;

    isAnimating = true;
    const currentElement = mockupViewer.querySelector('.mockup-item');
    if (currentElement) {
        (currentElement as HTMLElement).style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    mockupViewer.innerHTML = '';
    const newElement = mockupResults[index];
    newElement.style.opacity = '0';
    mockupViewer.appendChild(newElement);
    // Force reflow
    void newElement.offsetHeight;
    newElement.style.opacity = '1';

    currentMockupIndex = index;
    mockupCounter.textContent = `${index + 1} / ${mockupResults.length}`;
    mockupPrevBtn.disabled = index === 0;
    mockupNextBtn.disabled = index === mockupResults.length - 1;

    await new Promise(resolve => setTimeout(resolve, 200));
    isAnimating = false;
}

/** Opens the mockup modal. */
function openMockupModal() {
    mockupModal.classList.add('visible');
}

/** Closes the mockup modal. */
function closeMockupModal() {
    if (isAnimating) return;
    mockupModal.classList.remove('visible');
}

/**
 * Saves the logo history to localStorage.
 * @param {LogoData} [newItem] An optional new item to add to the history.
 */
function saveHistory(newItem?: LogoData) {
    if (newItem) {
        // Prevent duplicates
        logoHistory = logoHistory.filter(item => item.dataUrl !== newItem.dataUrl);
        logoHistory.unshift(newItem);
    }
    // Limit history size
    if (logoHistory.length > 20) {
        logoHistory = logoHistory.slice(0, 20);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(logoHistory));
    renderHistory();
}

/** Loads logo history from localStorage. */
function loadHistory() {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
        logoHistory = JSON.parse(savedHistory);
    }
    renderHistory();
}

/** Renders the logo history grid in the UI. */
function renderHistory() {
    historyGrid.innerHTML = '';
    historyCountSpan.textContent = `(${logoHistory.length})`;
    noHistoryMessage.classList.toggle('hidden', logoHistory.length === 0);
    clearHistoryBtn.classList.toggle('hidden', logoHistory.length === 0);

    logoHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.style.backgroundImage = `url(${item.dataUrl})`;
        historyItem.setAttribute('role', 'button');
        historyItem.setAttribute('aria-label', `Загрузить логотип: ${item.prompt}`);
        historyItem.dataset.index = index.toString();
        historyGrid.appendChild(historyItem);
    });
}

/** Clears the logo history after confirmation. */
function clearHistory() {
    showConfirmationModal('Вы уверены, что хотите удалить всю историю?', () => {
        logoHistory = [];
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        closeConfirmModal();
    });
}

/**
 * Handles clicking on a history item to load it.
 * @param {number} index The index of the item in the history array.
 */
function handleHistoryItemClick(index: number) {
    if (index >= 0 && index < logoHistory.length) {
        const item = logoHistory[index];
        originalGenerationData = item;
        promptInput.value = item.prompt;

        const mimeType = item.dataUrl.split(':')[1].split(';')[0] as 'image/jpeg' | 'image/png';
        formatButtons.forEach(btn => {
            const isActive = btn.dataset.format === mimeType;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-checked', String(isActive));
        });
        selectedFormat = mimeType;
        
        // Clear references when loading from history, as they were part of the original prompt
        referenceImages = [];
        renderThumbnails();
        colorInput.value = '';

        displayLogo(item.dataUrl);
        switchTab('generator');
        lockFormatSelection();
        lockReferenceInputs();
    }
}

/**
 * Handles the selection of a style. If a logo exists, it applies the new style.
 * @param {Event} e The click event.
 */
async function handleStyleSelection(e: Event) {
    const target = e.currentTarget as HTMLButtonElement;
    const style = target.dataset.style || '';

    if (target.disabled || !restyleOverlay.classList.contains('hidden')) {
        return;
    }

    styleButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
    });
    target.classList.add('active');
    target.setAttribute('aria-checked', 'true');
    selectedStyle = style;

    if (originalGenerationData) {
        await restyleLogo(style);
    }
}


/**
 * Resets the entire UI to its initial state.
 * @param {boolean} [force=false] - If true, bypasses the confirmation dialog.
 */
function resetUI(force = false) {
    const doReset = () => {
        promptInput.value = '';
        originalGenerationData = null;

        // Reset references
        referenceImages = [];
        colorInput.value = '';
        renderThumbnails();
        unlockReferenceInputs();

        // Set default style to "Classic"
        selectedStyle = 'Классический';
        styleButtons.forEach(btn => {
            const isClassic = btn.dataset.style === 'Классический';
            btn.classList.toggle('active', isClassic);
            btn.setAttribute('aria-checked', String(isClassic));
        });

        formatButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-checked', 'false');
        });
        
        selectedFormat = 'image/jpeg';
        const jpegBtn = document.querySelector('.format-btn[data-format="image/jpeg"]');
        if (jpegBtn) {
            jpegBtn.classList.add('active');
            jpegBtn.setAttribute('aria-checked', 'true');
        }

        resultWrapper.classList.add('hidden');
        loader.classList.add('hidden');
        resultPlaceholder.classList.remove('hidden');
        resultPlaceholder.innerHTML = '<p>Здесь появится ваш логотип</p>';
        generateBtn.textContent = 'Сгенерировать';
        generateBtn.disabled = !ai;
        
        unlockFormatSelection();
        updateStyleButtonsState(false);
        closeConfirmModal();
    };

    if (force || !originalGenerationData) {
        doReset();
    } else {
        showConfirmationModal('Вы уверены, что хотите сбросить все? Текущий логотип будет удален.', doReset);
    }
}

/** Renders the thumbnails for the selected reference images. */
function renderThumbnails() {
    thumbnailsContainer.innerHTML = '';
    referenceImages.forEach(img => {
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail';
        thumb.style.backgroundImage = `url(${img.dataUrl})`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'thumbnail-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.setAttribute('aria-label', `Remove ${img.id}`);
        removeBtn.onclick = () => {
            referenceImages = referenceImages.filter(i => i.id !== img.id);
            renderThumbnails();
        };
        
        thumb.appendChild(removeBtn);
        thumbnailsContainer.appendChild(thumb);
    });
}

/** Handles file input changes for reference images. */
function handleFileSelect(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;

    const remainingSlots = 3 - referenceImages.length;
    if (files.length > remainingSlots) {
        // Ideally, show a small error message here
        console.warn(`You can only upload ${remainingSlots} more image(s).`);
    }

    Array.from(files).slice(0, remainingSlots).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const base64Data = dataUrl.split(',')[1];
            referenceImages.push({
                id: `${file.name}-${Date.now()}`,
                mimeType: file.type,
                data: base64Data,
                dataUrl: dataUrl
            });
            renderThumbnails();
        };
        reader.readAsDataURL(file);
    });
    
    // Reset file input to allow re-uploading the same file
    (e.target as HTMLInputElement).value = '';
}


/**
 * Initializes the application, sets up event listeners.
 */
function initializeApp() {
    styleButtons.forEach(button => button.addEventListener('click', handleStyleSelection));
    formatButtons.forEach(button => button.addEventListener('click', handleFormatSelection));
    generateBtn.addEventListener('click', generateLogo);
    resetBtn.addEventListener('click', () => resetUI(false));
    downloadBtn.addEventListener('click', downloadLogo);
    mockupBtn.addEventListener('click', generateMockups);
    modalCloseBtn.addEventListener('click', closeMockupModal);
    settingsBtn.addEventListener('click', openSettingsModal);
    settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    clearApiKeyBtn.addEventListener('click', clearApiKey);
    clearHistoryBtn.addEventListener('click', clearHistory);
    referenceInput.addEventListener('change', handleFileSelect);

    // Drag and drop for reference images
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        referenceUploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        referenceUploadArea.addEventListener(eventName, () => referenceUploadArea.classList.add('hover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        referenceUploadArea.addEventListener(eventName, () => referenceUploadArea.classList.remove('hover'), false);
    });
    referenceUploadArea.addEventListener('drop', (e) => {
        const dt = (e as DragEvent).dataTransfer;
        if (dt) {
            const files = dt.files;
            handleFileSelect({ target: { files } } as unknown as Event);
        }
    }, false);


    confirmBtnYes.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
    });
    confirmBtnNo.addEventListener('click', closeConfirmModal);

    historyGrid.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.history-item') as HTMLElement | null;
        if (item && item.dataset.index) {
            handleHistoryItemClick(parseInt(item.dataset.index, 10));
        }
    });

    tabGeneratorBtn.addEventListener('click', () => switchTab('generator'));
    tabHistoryBtn.addEventListener('click', () => switchTab('history'));

    mockupPrevBtn.addEventListener('click', () => showMockup(currentMockupIndex - 1));
    mockupNextBtn.addEventListener('click', () => showMockup(currentMockupIndex + 1));

    // Set initial state
    resetUI(true);
    loadHistory();
    initializeAi();
}

// Start the application
initializeApp();