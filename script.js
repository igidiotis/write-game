// Main Script for WritingLab

// Global Variables
let sessionData = {
    sessionId: generateUUID(),
    startedAt: new Date().toISOString(),
    events: [],
    rules: [],
    finalStory: "",
    formResponses: {}
};

let typingTimer; // Timer for tracking pauses
let lastEventTime = Date.now();
let lastKeyPressBuffer = "";
let isSubmitting = false;
let appInitialized = false;

// ============== Initialization ==============
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM loaded, initializing app...");
        // Delay initialization slightly to ensure Firebase has time to load
        setTimeout(initializeApp, 100);
        
        // Add extra handler for dismiss error button
        const dismissBtn = document.getElementById('dismiss-error-btn');
        if (dismissBtn) {
            dismissBtn.onclick = dismissErrorDirectly;
            console.log("Added direct onclick handler to dismiss button");
        }
    } catch (e) {
        console.error("Error in initial setup:", e);
        alert("There was a problem initializing the app. Please check console for details.");
    }
});

// Direct error dismissal function that doesn't rely on event listeners
function dismissErrorDirectly() {
    console.log("Direct dismiss called");
    try {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.classList.add('hidden');
            console.log("Error dismissed directly");
        }
    } catch (e) {
        console.error("Error in direct dismissal:", e);
    }
}

function initializeApp() {
    try {
        console.log("Initializing app...");
        
        // Check if db exists (this comes from firebase.js)
        if (typeof db === 'undefined') {
            console.warn("Database not initialized yet, using localStorage fallback");
            // Create a fallback db if not already defined
            window.db = createLocalStorageDb();
        }
        
        // Initialize the writing area and events
        const writingArea = document.getElementById('writing-area');
        if (!writingArea) {
            throw new Error("Writing area element not found");
        }
        
        // Set up event listeners for writing area
        writingArea.addEventListener('input', handleWritingInput);
        writingArea.addEventListener('keydown', trackKeyDown);
        writingArea.addEventListener('paste', trackPaste);
        
        // Set up other UI event listeners with error handling
        setupButtonListeners();
        
        // Load any draft from localStorage
        loadDraft();
        
        // Initialize the first set of rules
        initializeRules();
        
        // Log the session start
        logEvent('session_started', {});
        
        console.log('App initialized with session ID:', sessionData.sessionId);
        appInitialized = true;
        
        // If there was an error message showing, dismiss it
        dismissError();
    } catch (e) {
        console.error("Error initializing app:", e);
        // Show a more user-friendly error message
        const errorMsg = "The app couldn't initialize properly. Please refresh the page and try again.";
        showError(errorMsg);
    }
}

// Separate function for setting up button listeners with error handling
function setupButtonListeners() {
    try {
        // Create an array of button IDs and their handler functions
        const buttons = [
            { id: 'submit-btn', handler: handleSubmission },
            { id: 'submit-feedback-btn', handler: handleFeedbackSubmission },
            { id: 'new-session-btn', handler: startNewSession },
            { id: 'export-json-btn', handler: exportSessionData },
            { id: 'dismiss-error-btn', handler: dismissError }
        ];
        
        // Set up each button
        buttons.forEach(button => {
            const element = document.getElementById(button.id);
            if (element) {
                // Add both event listener and direct onclick handler
                element.addEventListener('click', button.handler);
                element.onclick = button.handler;
                console.log(`Button listener set up for ${button.id}`);
            } else {
                console.warn(`Button ${button.id} not found in DOM`);
            }
        });
    } catch (e) {
        console.error("Error setting up button listeners:", e);
    }
}

// Fallback implementation using localStorage if Firebase fails to initialize
function createLocalStorageDb() {
    console.warn("Creating localStorage fallback database");
    
    return {
        collection: function(collectionName) {
            return {
                doc: function(docId) {
                    return {
                        set: function(data) {
                            return new Promise((resolve, reject) => {
                                try {
                                    // Create a key using collection and document ID
                                    const storageKey = `${collectionName}_${docId}`;
                                    
                                    // Store data in localStorage
                                    localStorage.setItem(storageKey, JSON.stringify(data));
                                    
                                    console.log(`Data saved to localStorage with key: ${storageKey}`);
                                    resolve();
                                } catch (error) {
                                    console.error("Error saving to localStorage:", error);
                                    reject(error);
                                }
                            });
                        },
                        get: function() {
                            return new Promise((resolve, reject) => {
                                try {
                                    const storageKey = `${collectionName}_${docId}`;
                                    const data = localStorage.getItem(storageKey);
                                    
                                    if (data) {
                                        resolve({
                                            exists: true,
                                            data: function() {
                                                return JSON.parse(data);
                                            }
                                        });
                                    } else {
                                        resolve({
                                            exists: false
                                        });
                                    }
                                } catch (error) {
                                    reject(error);
                                }
                            });
                        }
                    };
                }
            };
        }
    };
}

// ============== Writing Area Functionality ==============

function handleWritingInput(e) {
    try {
        // Update word count
        updateWordCount();
        
        // Track typing in buffer
        lastKeyPressBuffer += e.data || '';
        
        // Clear any existing timer
        clearTimeout(typingTimer);
        
        // Set a new timer to track pause
        typingTimer = setTimeout(() => {
            // If we have content in the buffer, log it
            if (lastKeyPressBuffer) {
                logEvent('typed', { content: lastKeyPressBuffer });
                lastKeyPressBuffer = ""; // Clear the buffer
            }
            
            // Check for pause
            const currentTime = Date.now();
            const timeSinceLastEvent = currentTime - lastEventTime;
            
            if (timeSinceLastEvent > 3000) { // 3 seconds pause
                logEvent('paused', { duration: timeSinceLastEvent });
            }
            
            lastEventTime = currentTime;
            
            // Save draft to localStorage
            saveDraft();
            
            // Check rules based on current content
            checkRules();
            
        }, 1000); // Batch events after 1 second of inactivity
    } catch (e) {
        console.error("Error handling writing input:", e);
    }
}

function trackKeyDown(e) {
    try {
        // Special case for deletions
        if (e.key === 'Backspace' || e.key === 'Delete') {
            // Commit any pending typing
            if (lastKeyPressBuffer) {
                logEvent('typed', { content: lastKeyPressBuffer });
                lastKeyPressBuffer = "";
            }
            
            logEvent('deleted', { key: e.key });
            lastEventTime = Date.now();
        }
    } catch (e) {
        console.error("Error tracking key down:", e);
    }
}

function trackPaste(e) {
    try {
        // Commit any pending typing
        if (lastKeyPressBuffer) {
            logEvent('typed', { content: lastKeyPressBuffer });
            lastKeyPressBuffer = "";
        }
        
        // Get pasted content if available
        const pastedText = e.clipboardData ? e.clipboardData.getData('text') : 'unknown content';
        
        logEvent('pasted', { content: pastedText });
        lastEventTime = Date.now();
        
        // Check rules after paste
        setTimeout(checkRules, 100);
    } catch (e) {
        console.error("Error tracking paste:", e);
    }
}

function updateWordCount() {
    try {
        const writingArea = document.getElementById('writing-area');
        if (!writingArea) {
            console.warn("Writing area not found when updating word count");
            return 0;
        }
        
        const text = writingArea.value;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        
        const wordCountElement = document.getElementById('word-count');
        if (wordCountElement) {
            wordCountElement.innerText = wordCount;
        }
        
        return wordCount;
    } catch (e) {
        console.error("Error updating word count:", e);
        return 0;
    }
}

// ============== Rules System ==============

function initializeRules() {
    try {
        // Initial set of rules
        const initialRules = [
            {
                id: 'intro',
                title: 'Begin with an intriguing opening',
                description: 'Start your story with something that immediately hooks the reader',
                type: 'required',
                state: 'active',
                triggerType: 'immediate',
                checkCondition: () => true // Always shown initially
            },
            {
                id: 'character',
                title: 'Introduce a main character',
                description: 'Create a character with a clear desire or motivation',
                type: 'required',
                state: 'active',
                triggerType: 'immediate',
                checkCondition: () => true // Always shown initially
            },
            {
                id: 'setting',
                title: 'Establish a vivid setting',
                description: 'Describe where and when your story takes place',
                type: 'required',
                state: 'active',
                triggerType: 'immediate',
                checkCondition: () => true // Always shown initially
            }
        ];
        
        // Rules that appear based on triggers
        const conditionalRules = [
            {
                id: 'conflict',
                title: 'Introduce a conflict',
                description: 'Add tension or an obstacle for your character to overcome',
                type: 'required',
                state: 'inactive',
                triggerType: 'wordCount',
                triggerValue: 50,
                checkCondition: (text, wordCount) => wordCount >= 50
            },
            {
                id: 'dialog',
                title: 'Include some dialogue',
                description: 'Let your characters speak to reveal more about them',
                type: 'optional',
                state: 'inactive',
                triggerType: 'wordCount',
                triggerValue: 100,
                checkCondition: (text, wordCount) => wordCount >= 100
            },
            {
                id: 'twist',
                title: 'Add an unexpected element',
                description: 'Surprise the reader with something they didn\'t see coming',
                type: 'optional',
                state: 'inactive',
                triggerType: 'wordCount',
                triggerValue: 150,
                checkCondition: (text, wordCount) => wordCount >= 150
            },
            {
                id: 'resolution',
                title: 'Work toward a resolution',
                description: 'Begin wrapping up the story elements you\'ve introduced',
                type: 'required',
                state: 'inactive',
                triggerType: 'wordCount',
                triggerValue: 200,
                checkCondition: (text, wordCount) => wordCount >= 200
            }
        ];
        
        // Combine all rules and save to session data
        sessionData.rules = [...initialRules, ...conditionalRules];
        
        // Render the initial active rules
        renderRules();
    } catch (e) {
        console.error("Error initializing rules:", e);
    }
}

function renderRules() {
    try {
        const rulesContainer = document.getElementById('rules-list');
        if (!rulesContainer) {
            console.warn("Rules container not found");
            return;
        }
        
        rulesContainer.innerHTML = '';
        
        // Filter only active rules
        const activeRules = sessionData.rules.filter(rule => rule.state !== 'inactive');
        
        // Create and append rule elements
        activeRules.forEach(rule => {
            const ruleElement = createRuleElement(rule);
            rulesContainer.appendChild(ruleElement);
        });
    } catch (e) {
        console.error("Error rendering rules:", e);
    }
}

function createRuleElement(rule) {
    try {
        const ruleElement = document.createElement('div');
        ruleElement.className = `rule-item ${rule.type} ${rule.state}`;
        ruleElement.dataset.ruleId = rule.id;
        
        const ruleContent = document.createElement('div');
        ruleContent.className = 'rule-content';
        
        const ruleTitle = document.createElement('div');
        ruleTitle.className = 'rule-title';
        ruleTitle.textContent = rule.title;
        
        const ruleDescription = document.createElement('div');
        ruleDescription.className = 'rule-description';
        ruleDescription.textContent = rule.description;
        
        ruleContent.appendChild(ruleTitle);
        ruleContent.appendChild(ruleDescription);
        ruleElement.appendChild(ruleContent);
        
        // If optional and not met/skipped, add skip button
        if (rule.type === 'optional' && rule.state === 'active') {
            const skipButton = document.createElement('button');
            skipButton.className = 'skip-btn rule-action';
            skipButton.textContent = 'Skip';
            
            // Add both event listener and direct onclick handler
            skipButton.addEventListener('click', () => skipRule(rule.id));
            skipButton.onclick = () => skipRule(rule.id);
            
            ruleElement.appendChild(skipButton);
        }
        
        return ruleElement;
    } catch (e) {
        console.error("Error creating rule element:", e);
        // Return an empty div as fallback
        return document.createElement('div');
    }
}

function checkRules() {
    try {
        const writingArea = document.getElementById('writing-area');
        if (!writingArea) {
            console.warn("Writing area not found when checking rules");
            return;
        }
        
        const text = writingArea.value;
        const wordCount = updateWordCount();
        
        let rulesChanged = false;
        
        // Check each rule
        sessionData.rules.forEach(rule => {
            // Skip rules that are already met or skipped
            if (rule.state === 'met' || rule.state === 'skipped') return;
            
            // Check inactive rules to see if they should become active
            if (rule.state === 'inactive') {
                const shouldActivate = rule.checkCondition(text, wordCount);
                if (shouldActivate) {
                    rule.state = 'active';
                    rulesChanged = true;
                    
                    // Log rule activation
                    logEvent('rule_activated', { ruleId: rule.id });
                }
            }
            
            // For simplicity, we'll use some basic checks for rule completion
            if (rule.state === 'active') {
                // Simple heuristic - if text contains keywords related to the rule
                let isMet = false;
                
                switch(rule.id) {
                    case 'intro':
                        // Assuming any text of 20+ words has an intro
                        isMet = wordCount >= 20;
                        break;
                    case 'character':
                        // Check for character indicators (names, pronouns)
                        isMet = /\b(he|she|they|[A-Z][a-z]+)\b/i.test(text);
                        break;
                    case 'setting':
                        // Check for setting keywords (place, time indicators)
                        isMet = /\b(room|house|building|city|morning|night|day|time|place|at the|in the)\b/i.test(text);
                        break;
                    case 'conflict':
                        // Check for conflict keywords
                        isMet = /\b(problem|trouble|challenge|difficult|struggle|conflict|afraid|worry|tension|obstacle)\b/i.test(text);
                        break;
                    case 'dialog':
                        // Check for dialog indicators (quotes)
                        isMet = /["'].*?["']/.test(text);
                        break;
                    case 'twist':
                        // Hard to detect automatically, we'll just check for "surprise" words
                        isMet = /\b(suddenly|surprise|unexpected|shocked|revealed|twist|turn|changed)\b/i.test(text);
                        break;
                    case 'resolution':
                        // Check for resolution indicators
                        isMet = /\b(finally|eventually|resolved|ended|conclusion|decided|realized|understood|learned)\b/i.test(text);
                        break;
                    default:
                        break;
                }
                
                if (isMet) {
                    rule.state = 'met';
                    rulesChanged = true;
                    
                    // Log rule completion
                    logEvent('rule_met', { ruleId: rule.id });
                }
            }
        });
        
        // Re-render rules if changes occurred
        if (rulesChanged) {
            renderRules();
        }
    } catch (e) {
        console.error("Error checking rules:", e);
    }
}

function skipRule(ruleId) {
    try {
        // Find the rule by ID
        const rule = sessionData.rules.find(r => r.id === ruleId);
        
        if (rule && rule.type === 'optional') {
            rule.state = 'skipped';
            renderRules();
            
            // Log rule skipped
            logEvent('rule_skipped', { ruleId });
        }
    } catch (e) {
        console.error("Error skipping rule:", e);
    }
}

// ============== Submission and Follow-up ==============

function handleSubmission() {
    try {
        // Commit any pending typing first
        if (lastKeyPressBuffer) {
            logEvent('typed', { content: lastKeyPressBuffer });
            lastKeyPressBuffer = "";
        }
        
        // Get the final story
        const writingArea = document.getElementById('writing-area');
        if (!writingArea) {
            showError("Cannot find writing area. Please refresh the page.");
            return;
        }
        
        const finalStory = writingArea.value.trim();
        
        // Validate submission
        if (!finalStory) {
            showError("Please write something before submitting.");
            return;
        }
        
        // Check required rules
        const unmetRequiredRules = sessionData.rules.filter(
            rule => rule.type === 'required' && rule.state !== 'met'
        );
        
        if (unmetRequiredRules.length > 0) {
            const ruleNames = unmetRequiredRules.map(r => r.title).join(', ');
            showError(`Please complete all required elements: ${ruleNames}`);
            return;
        }
        
        // Hide submit button and show follow-up form
        const submitBtn = document.getElementById('submit-btn');
        const followUpForm = document.getElementById('follow-up-form');
        
        if (submitBtn) submitBtn.classList.add('hidden');
        if (followUpForm) followUpForm.classList.remove('hidden');
        
        // Save the final story to session data
        sessionData.finalStory = finalStory;
        logEvent('story_submitted', { wordCount: updateWordCount() });
        
        // Populate influential rule dropdown
        const selectElement = document.getElementById('influential-rule');
        if (selectElement) {
            selectElement.innerHTML = '';
            
            // Add only rules that are met or skipped
            sessionData.rules
                .filter(rule => rule.state === 'met' || rule.state === 'skipped')
                .forEach(rule => {
                    const option = document.createElement('option');
                    option.value = rule.id;
                    option.textContent = rule.title;
                    selectElement.appendChild(option);
                });
        }
    } catch (e) {
        console.error("Error handling submission:", e);
        showError("There was a problem with your submission. Please try again.");
    }
}

function handleFeedbackSubmission() {
    try {
        // Check if already submitting to prevent double submissions
        if (isSubmitting) return;
        isSubmitting = true;
        
        // Show loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        
        // Collect form responses
        const emotionalResponse = document.querySelector('input[name="emotionalResponse"]:checked')?.value || '';
        const influentialRule = document.getElementById('influential-rule')?.value || '';
        const creativeDecisions = document.getElementById('creative-decisions')?.value || '';
        
        // Add form responses to session data
        sessionData.formResponses = {
            emotionalResponse,
            influentialRule,
            creativeDecisions
        };
        
        // Log form submission
        logEvent('feedback_submitted', sessionData.formResponses);
        
        // Check if we have a database reference
        if (typeof db === 'undefined') {
            console.warn("Database not available, creating localStorage fallback");
            window.db = createLocalStorageDb();
        }
        
        // Submit data to Firebase or localStorage
        saveSessionToFirebase()
            .then(() => {
                // Hide loading indicator and follow-up form
                if (loadingIndicator) loadingIndicator.classList.add('hidden');
                
                const followUpForm = document.getElementById('follow-up-form');
                if (followUpForm) followUpForm.classList.add('hidden');
                
                // Show confirmation message
                const confirmationMessage = document.getElementById('confirmation-message');
                if (confirmationMessage) confirmationMessage.classList.remove('hidden');
                
                // Clear the draft from localStorage
                localStorage.removeItem('writingLabDraft');
                
                isSubmitting = false;
            })
            .catch(error => {
                console.error("Error saving session:", error);
                if (loadingIndicator) loadingIndicator.classList.add('hidden');
                showError("There was a problem saving your data. Please try again.");
                isSubmitting = false;
            });
    } catch (e) {
        console.error("Error handling feedback submission:", e);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        showError("There was a problem submitting your feedback. Please try again.");
        isSubmitting = false;
    }
}

// ============== Storage and Persistence ==============

function saveSessionToFirebase() {
    try {
        // Check if we have a database reference
        if (typeof db === 'undefined') {
            console.warn("Database not available, creating localStorage fallback");
            window.db = createLocalStorageDb();
        }
        
        return db.collection('sessions').doc(sessionData.sessionId).set(sessionData);
    } catch (e) {
        console.error("Error saving to Firebase:", e);
        // Fallback to localStorage
        const storageKey = `sessions_${sessionData.sessionId}`;
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
        return Promise.resolve(); // Return a resolved promise to continue the flow
    }
}

function saveDraft() {
    try {
        const writingArea = document.getElementById('writing-area');
        if (!writingArea) return;
        
        const text = writingArea.value;
        localStorage.setItem('writingLabDraft', text);
    } catch (e) {
        console.error("Error saving draft:", e);
    }
}

function loadDraft() {
    try {
        const savedDraft = localStorage.getItem('writingLabDraft');
        if (savedDraft) {
            const writingArea = document.getElementById('writing-area');
            if (writingArea) {
                writingArea.value = savedDraft;
                updateWordCount();
                checkRules();
                logEvent('draft_loaded', { length: savedDraft.length });
            }
        }
    } catch (e) {
        console.error("Error loading draft:", e);
    }
}

function startNewSession() {
    try {
        // Reset the session data
        sessionData = {
            sessionId: generateUUID(),
            startedAt: new Date().toISOString(),
            events: [],
            rules: [],
            finalStory: "",
            formResponses: {}
        };
        
        // Clear the writing area
        const writingArea = document.getElementById('writing-area');
        if (writingArea) writingArea.value = '';
        updateWordCount();
        
        // Reset UI
        const confirmationMessage = document.getElementById('confirmation-message');
        const submitBtn = document.getElementById('submit-btn');
        
        if (confirmationMessage) confirmationMessage.classList.add('hidden');
        if (submitBtn) submitBtn.classList.remove('hidden');
        
        // Re-initialize rules
        initializeRules();
        
        // Log new session
        logEvent('session_started', {});
        
        console.log('New session started with ID:', sessionData.sessionId);
    } catch (e) {
        console.error("Error starting new session:", e);
        showError("There was a problem starting a new session. Please refresh the page.");
    }
}

function exportSessionData() {
    try {
        // Create a blob with the JSON data
        const dataStr = JSON.stringify(sessionData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        // Create download link and trigger click
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `writinglab-${sessionData.sessionId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        logEvent('session_exported', {});
    } catch (e) {
        console.error("Error exporting session data:", e);
        showError("There was a problem exporting the data. Please try again.");
    }
}

// ============== Error Handling ==============

function showError(message) {
    try {
        console.error("Error being shown:", message);
        const errorElement = document.getElementById('error-message');
        if (!errorElement) {
            console.error("Error element not found in DOM!");
            // Create a fallback error message if the element doesn't exist
            const fallbackError = document.createElement('div');
            fallbackError.id = 'fallback-error';
            fallbackError.style.position = 'fixed';
            fallbackError.style.top = '20px';
            fallbackError.style.left = '50%';
            fallbackError.style.transform = 'translateX(-50%)';
            fallbackError.style.padding = '15px';
            fallbackError.style.backgroundColor = 'rgba(255, 59, 48, 0.9)';
            fallbackError.style.color = 'white';
            fallbackError.style.borderRadius = '8px';
            fallbackError.style.zIndex = '1001';
            fallbackError.textContent = message;
            
            const dismissBtn = document.createElement('button');
            dismissBtn.textContent = 'Dismiss';
            dismissBtn.style.marginLeft = '10px';
            dismissBtn.style.padding = '5px 10px';
            dismissBtn.style.border = 'none';
            dismissBtn.style.borderRadius = '4px';
            dismissBtn.style.cursor = 'pointer';
            dismissBtn.onclick = function() {
                document.body.removeChild(fallbackError);
            };
            
            fallbackError.appendChild(dismissBtn);
            document.body.appendChild(fallbackError);
            return;
        }
        
        // Set the error message text
        const errorTextElement = errorElement.querySelector('p');
        if (errorTextElement) {
            errorTextElement.textContent = message;
        } else {
            // If there's no p element, set the text directly
            errorElement.innerHTML = `<p>${message}</p><button id="dismiss-error-btn" class="secondary-btn">Dismiss</button>`;
            const newDismissBtn = errorElement.querySelector('#dismiss-error-btn');
            if (newDismissBtn) {
                newDismissBtn.onclick = dismissErrorDirectly;
            }
        }
        
        // Show the error element
        errorElement.classList.remove('hidden');
        errorElement.style.display = 'flex';
        
        // Add direct onclick handler to dismiss button
        const dismissBtn = errorElement.querySelector('#dismiss-error-btn');
        if (dismissBtn) {
            dismissBtn.onclick = dismissErrorDirectly;
        }
    } catch (e) {
        console.error("Error in showError function:", e);
        // Last resort - use browser alert
        alert(message);
    }
}

function dismissError() {
    try {
        console.log("Regular dismiss called");
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.classList.add('hidden');
            errorElement.style.display = 'none';
            console.log("Error dismissed normally");
        }
    } catch (e) {
        console.error("Error dismissing error:", e);
    }
}

// ============== Utility Functions ==============

function generateUUID() {
    try {
        // Simple UUID generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    } catch (e) {
        console.error("Error generating UUID:", e);
        // Fallback with timestamp and random numbers
        return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
}

function logEvent(type, data) {
    try {
        const event = {
            type,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        sessionData.events.push(event);
        console.log('Event logged:', event);
    } catch (e) {
        console.error("Error logging event:", e);
    }
}

// Add window error handler to catch any unhandled errors
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Global error caught:", message, "at", source, "line", lineno, "column", colno, "Error object:", error);
    
    // Only show error to user if app has already initialized
    if (appInitialized) {
        showError("An unexpected error occurred. Please check console for details.");
    }
    
    return true; // Prevents the browser from showing its own error dialog
};
