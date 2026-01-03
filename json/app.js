// Global variables and DOM elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const notification = document.getElementById('notification');

// Formatting tool related elements
const jsonInput = document.getElementById('jsonInput');
const jsonOutput = document.getElementById('jsonOutput');
const formatBtn = document.getElementById('formatBtn');
const minifyBtn = document.getElementById('minifyBtn');
const escapeBtn = document.getElementById('escapeBtn');
const unescapeBtn = document.getElementById('unescapeBtn');
const validateBtn = document.getElementById('validateBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const inputCharCount = document.getElementById('inputCharCount');
const outputCharCount = document.getElementById('outputCharCount');
const sortKeysCheckbox = document.getElementById('sortKeys');
const escapeOutputCheckbox = document.getElementById('escapeOutput');
const indentSizeSelect = document.getElementById('indentSize');

// Comparison tool related elements
const compareLeft = document.getElementById('compareLeft');
const compareRight = document.getElementById('compareRight');
const compareBtn = document.getElementById('compareBtn');
const diffLeft = document.getElementById('diffLeft');
const diffRight = document.getElementById('diffRight');
const compareLeftCharCount = document.getElementById('compareLeftCharCount');
const compareRightCharCount = document.getElementById('compareRightCharCount');

// Tab switching functionality
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab');

    // Update tab status
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Show corresponding content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === targetTab) {
        content.classList.add('active');
      }
    });
  });
});

// Update character count
function updateCharCount(textarea, countElement) {
  countElement.textContent = textarea.value.length;
}

// Add character count update for all text areas
[jsonInput, compareLeft, compareRight].forEach((textarea, index) => {
  const countElements = [inputCharCount, compareLeftCharCount, compareRightCharCount];
  textarea.addEventListener('input', () => updateCharCount(textarea, countElements[index]));
  // Initialize character count
  updateCharCount(textarea, countElements[index]);
});

// Show notification
function showNotification(message, isError = false) {
  const icon = notification.querySelector('i');
  const text = notification.querySelector('span');

  text.textContent = message;

  if (isError) {
    notification.classList.remove('success');
    notification.classList.add('error');
    icon.className = 'fas fa-exclamation-circle';
  } else {
    notification.classList.remove('error');
    notification.classList.add('success');
    icon.className = 'fas fa-check-circle';
  }

  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Deep sort object keys
function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });

  return sorted;
}

// Format JSON
function formatJSON(jsonStr, sortKeys = true, indent = 4) {
  try {
    let parsed = JSON.parse(jsonStr);

    if (sortKeys) {
      parsed = sortObjectKeys(parsed);
    }

    if (indent === 'tab') {
      return JSON.stringify(parsed, null, '\t');
    } else {
      return JSON.stringify(parsed, null, parseInt(indent) || 4);
    }
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

// Minify JSON
function minifyJSON(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    return JSON.stringify(parsed);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

// Escape JSON string
function escapeJSON(jsonStr) {
  return jsonStr
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
}

// Unescape JSON string
function unescapeJSON(jsonStr) {
  return jsonStr
          .replace(/\\\\/g, '\\')
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t');
}

// Validate JSON
function validateJSON(jsonStr) {
  try {
    JSON.parse(jsonStr);
    return { valid: true, message: '✅ JSON format is correct' };
  } catch (error) {
    return { valid: false, message: `❌ JSON format error: ${error.message}` };
  }
}

// Formatting tool event listeners
formatBtn.addEventListener('click', () => {
  try {
    const input = jsonInput.value.trim();
    if (!input) {
      showNotification('Please enter JSON data', true);
      return;
    }

    const indent = indentSizeSelect.value;
    const sorted = sortKeysCheckbox.checked;
    const escaped = escapeOutputCheckbox.checked;

    let formatted = formatJSON(input, sorted, indent);

    if (escaped) {
      formatted = escapeJSON(formatted);
    }

    jsonOutput.value = formatted;
    updateCharCount(jsonOutput, outputCharCount);
    showNotification('JSON formatting successful');
  } catch (error) {
    showNotification(error.message, true);
  }
});

minifyBtn.addEventListener('click', () => {
  try {
    const input = jsonInput.value.trim();
    if (!input) {
      showNotification('Please enter JSON data', true);
      return;
    }

    const minified = minifyJSON(input);
    jsonOutput.value = minified;
    updateCharCount(jsonOutput, outputCharCount);
    showNotification('JSON minification successful');
  } catch (error) {
    showNotification(error.message, true);
  }
});

escapeBtn.addEventListener('click', () => {
  const input = jsonInput.value.trim();
  if (!input) {
    showNotification('Please enter JSON data', true);
    return;
  }

  try {
    // First validate JSON format
    JSON.parse(input);
    const escaped = escapeJSON(input);
    jsonOutput.value = escaped;
    updateCharCount(jsonOutput, outputCharCount);
    showNotification('JSON escaping successful');
  } catch (error) {
    showNotification(`Invalid JSON: ${error.message}`, true);
  }
});

unescapeBtn.addEventListener('click', () => {
  const input = jsonInput.value.trim();
  if (!input) {
    showNotification('Please enter JSON data', true);
    return;
  }

  try {
    const unescaped = unescapeJSON(input);
    // Try to parse to validate format
    JSON.parse(unescaped);
    jsonOutput.value = unescaped;
    updateCharCount(jsonOutput, outputCharCount);
    showNotification('JSON unescaping successful');
  } catch (error) {
    showNotification(`Unescaped JSON is invalid: ${error.message}`, true);
  }
});

validateBtn.addEventListener('click', () => {
  const input = jsonInput.value.trim();
  if (!input) {
    showNotification('Please enter JSON data', true);
    return;
  }

  const result = validateJSON(input);
  showNotification(result.message, !result.valid);

  if (result.valid) {
    jsonOutput.value = '✅ JSON format is correct\n\n' + input;
    updateCharCount(jsonOutput, outputCharCount);
  } else {
    jsonOutput.value = '❌ JSON format error\n\n' + input;
    updateCharCount(jsonOutput, outputCharCount);
  }
});

clearBtn.addEventListener('click', () => {
  jsonInput.value = '';
  jsonOutput.value = '';
  updateCharCount(jsonInput, inputCharCount);
  updateCharCount(jsonOutput, outputCharCount);
  showNotification('Input and output cleared');
});

copyBtn.addEventListener('click', async () => {
  if (!jsonOutput.value.trim()) {
    showNotification('No content to copy', true);
    return;
  }

  try {
    await navigator.clipboard.writeText(jsonOutput.value);
    showNotification('Copied to clipboard');
  } catch (error) {
    // Fallback method
    jsonOutput.select();
    document.execCommand('copy');
    showNotification('Copied to clipboard (using fallback method)');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!jsonOutput.value.trim()) {
    showNotification('No content to download', true);
    return;
  }

  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'formatted.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('JSON file downloaded');
});

// JSON comparison function
function compareJSON(json1, json2) {
  try {
    // Parse and format both JSONs
    const obj1 = JSON.parse(json1);
    const obj2 = JSON.parse(json2);

    // Sort keys
    const sorted1 = sortObjectKeys(obj1);
    const sorted2 = sortObjectKeys(obj2);

    // Convert to strings and split into lines
    const str1 = JSON.stringify(sorted1, null, 2);
    const str2 = JSON.stringify(sorted2, null, 2);

    const lines1 = str1.split('\n');
    const lines2 = str2.split('\n');

    // Simple line comparison algorithm
    const maxLines = Math.max(lines1.length, lines2.length);
    const diff1 = [];
    const diff2 = [];

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === line2) {
        // Same line
        diff1.push({ type: 'unchanged', content: line1 || '' });
        diff2.push({ type: 'unchanged', content: line2 || '' });
      } else if (!line1 && line2) {
        // Line1 doesn't exist, line2 exists (added)
        diff1.push({ type: 'removed', content: '' });
        diff2.push({ type: 'added', content: line2 });
      } else if (line1 && !line2) {
        // Line1 exists, line2 doesn't exist (removed)
        diff1.push({ type: 'removed', content: line1 });
        diff2.push({ type: 'added', content: '' });
      } else {
        // Different line content
        diff1.push({ type: 'removed', content: line1 });
        diff2.push({ type: 'added', content: line2 });
      }
    }

    return { diff1, diff2, str1, str2 };
  } catch (error) {
    throw new Error(`JSON parsing error: ${error.message}`);
  }
}

// Add syntax highlighting to JSON lines
function highlightJSON(line) {
  if (!line) return '';

  // Process keys
  let highlighted = line.replace(/"([^"]+)":/g, '<span class="diff-key">"$1"</span>:');

  // Process string values
  highlighted = highlighted.replace(/:\s*"([^"]*)"/g, ': <span class="diff-string">"$1"</span>');

  // Process numbers
  highlighted = highlighted.replace(/:\s*(\d+\.?\d*)/g, ': <span class="diff-number">$1</span>');

  // Process booleans
  highlighted = highlighted.replace(/:\s*(true|false)/g, ': <span class="diff-boolean">$1</span>');

  // Process null
  highlighted = highlighted.replace(/:\s*(null)/g, ': <span class="diff-null">$1</span>');

  return highlighted;
}

// Comparison tool event listener
compareBtn.addEventListener('click', () => {
  const json1 = compareLeft.value.trim();
  const json2 = compareRight.value.trim();

  if (!json1 || !json2) {
    showNotification('Please enter both JSON data', true);
    return;
  }

  try {
    const result = compareJSON(json1, json2);

    // Display results
    diffLeft.innerHTML = result.diff1.map(diff => {
      const className = `diff-line ${diff.type}`;
      const content = diff.type === 'unchanged' ? diff.content : `- ${diff.content}`;
      return `<div class="${className}">${highlightJSON(content)}</div>`;
    }).join('');

    diffRight.innerHTML = result.diff2.map(diff => {
      const className = `diff-line ${diff.type}`;
      const content = diff.type === 'unchanged' ? diff.content : `+ ${diff.content}`;
      return `<div class="${className}">${highlightJSON(content)}</div>`;
    }).join('');

    showNotification('JSON comparison completed');
  } catch (error) {
    showNotification(`Comparison failed: ${error.message}`, true);
  }
});

// Initialize escape output checkbox state
escapeOutputCheckbox.checked = false;