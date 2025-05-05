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

// ============== Initialization ==============
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Initialize the writing area and events
    const writingArea = document.getElementById('writing-area');
    
    // Set up event listeners for writing area
    writingArea.addEventListener('input', handleWritingInput);
    writingArea.addEventListener('keydown', trackKeyDown);
    writingArea.addEventListener('paste', trackPaste);
    
    // Set up other UI event listeners
    document.getElementById('submit-btn').addEventListener('click', handleSubmission);
    document.getElementById('submit-feedback-btn').addEventListener('click', handleFeedbackSubmission);
    document.getElementById('new-session-btn').addEventListener('click', startNewSession);
    document.getElementById('export-json-btn').addEventListener('click', exportSessionData);
    document.getElementById('dismiss-error-btn').addEventListener('click', dismissError);
    
    // Load any draft from localStorage
    loadDraft();
    
    // Initialize the first set of rules
    initializeRules();
    
    // Log the session start
    logEvent('session_started', {});
    
    console.log('App initialized with session ID:', sessionData.sessionId);
}

// ============== Writing Area Functionality ==============

function handleWritingInput(e) {
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
}

function trackKeyDown(e) {
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
}

function trackPaste(e) {
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
}

function updateWordCount() {
    const text = document.getElementById('writing-area').value;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    
    document.getElementById('word-count').innerText = wordCount;
    return wordCount;
}

// ============== Rules System ==============

function initializeRules() {
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
}

function renderRules() {
    const rulesContainer = document.getElementById('rules-list');
    rulesContainer.innerHTML = '';
    
    // Filter only active rules
    const activeRules = sessionData.rules.filter(rule => rule.state !== 'inactive');
    
    // Create and append rule elements
    activeRules.forEach(rule => {
        const ruleElement = createRuleElement(rule);
        rulesContainer.appendChild(ruleElement);
    });
}

function createRuleElement(rule) {
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
        skipButton.addEventListener('click', () => {
            skipRule(rule.id);
        });
        ruleElement.appendChild(skipButton);
    }
    
    return ruleElement;
}

function checkRules() {
    const writingArea = document.getElementById('writing-area');
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
        // In a real app, you'd have more sophisticated rule checking logic
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
}

function skipRule(ruleId) {
    // Find the rule by ID
    const rule = sessionData.rules.find(r => r.id === ruleId);
    
    if (rule && rule.type === 'optional') {
        rule.state = 'skipped';
        renderRules();
        
        // Log rule skipped
        logEvent('rule_skipped', { ruleId });
    }
}

// ============== Submission and Follow-up ==============

function handleSubmission() {
    // Commit any pending typing first
    if (lastKeyPressBuffer) {
        logEvent('typed', { content: lastKeyPressBuffer });
        lastKeyPressBuffer = "";
    }
    
    // Get the final story
    const writingArea = document.getElementById('writing-area');
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
    document.getElementById('submit-btn').classList.add('hidden');
    document.getElementById('follow-up-form').classList.remove('hidden');
    
    // Save the final story to session data
    sessionData.finalStory = finalStory;
    logEvent('story_submitted', { wordCount: updateWordCount() });
    
    // Populate influential rule dropdown
    const selectElement = document.getElementById('influential-rule');
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

function handleFeedbackSubmission() {
    // Check if already submitting to prevent double submissions
    if (isSubmitting) return;
    isSubmitting = true;
    
    // Show loading indicator
    document.getElementById('loading-indicator').classList.remove('hidden');
    
    // Collect form responses
    const emotionalResponse = document.querySelector('input[name="emotionalResponse"]:checked')?.value || '';
    const influentialRule = document.getElementById('influential-rule').value;
    const creativeDecisions = document.getElementById('creative-decisions').value;
    
    // Add form responses to session data
    sessionData.formResponses = {
        emotionalResponse,
        influentialRule,
        creativeDecisions
    };
    
    // Log form submission
    logEvent('feedback_submitted', sessionData.formResponses);
    
    // Submit data to Firebase
    saveSessionToFirebase()
        .then(() => {
            // Hide loading indicator and follow-up form
            document.getElementById('loading-indicator').classList.add('hidden');
            document.getElementById('follow-up-form').classList.add('hidden');
            
            // Show confirmation message
            document.getElementById('confirmation-message').classList.remove('hidden');
            
            // Clear the draft from localStorage
            localStorage.removeItem('writingLabDraft');
            
            isSubmitting = false;
        })
        .catch(error => {
            console.error("Error saving session:", error);
            document.getElementById('loading-indicator').classList.add('hidden');
            showError("There was a problem saving your data. Please try again.");
            isSubmitting = false;
        });
}

// ============== Storage and Persistence ==============

function saveSessionToFirebase() {
    return db.collection('sessions').doc(sessionData.sessionId).set(sessionData);
}

function saveDraft() {
    const text = document.getElementById('writing-area').value;
    localStorage.setItem('writingLabDraft', text);
}

function loadDraft() {
    const savedDraft = localStorage.getItem('writingLabDraft');
    if (savedDraft) {
        document.getElementById('writing-area').value = savedDraft;
        updateWordCount();
        checkRules();
        logEvent('draft_loaded', { length: savedDraft.length });
    }
}

function startNewSession() {
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
    document.getElementById('writing-area').value = '';
    updateWordCount();
    
    // Reset UI
    document.getElementById('confirmation-message').classList.add('hidden');
    document.getElementById('submit-btn').classList.remove('hidden');
    
    // Re-initialize rules
    initializeRules();
    
    // Log new session
    logEvent('session_started', {});
    
    console.log('New session started with ID:', sessionData.sessionId);
}

function exportSessionData() {
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
}

// ============== Error Handling ==============

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.querySelector('p').textContent = message;
    errorElement.classList.remove('hidden');
}

function dismissError() {
    document.getElementById('error-message').classList.add('hidden');
}

// ============== Utility Functions ==============

function generateUUID() {
    // Simple UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function logEvent(type, data) {
    const event = {
        type,
        timestamp: new Date().toISOString(),
        ...data
    };
    
    sessionData.events.push(event);
    console.log('Event logged:', event);
}