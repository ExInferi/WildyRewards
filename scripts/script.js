import * as util from './utility.js';

// Enable "Add App" button for Alt1 Browser
A1lib.identifyApp('appconfig.json');

// Set up main constants
const APP_PREFIX = 'wildyRewards';

const SELECTED_CHAT = `${APP_PREFIX}Chat`;
const DATA_STORAGE = `${APP_PREFIX}Data`;
const CHAT_SESSION = `${APP_PREFIX}ChatHistory`;
const TOTALS_PREFIX = `${APP_PREFIX}Totals_`;
const DISPLAY_MODE = `${APP_PREFIX}Display`;

// Themed app color
const COL = [180, 195, 152];

// Addional constants
const appURL = window.location.href.replace('index.html', '');
const appColor = A1lib.mixColor(COL[0], COL[1], COL[2]);
const rgbColor = `rgb(${COL[0]}, ${COL[1]}, ${COL[2]})`;
const showTotals = document.getElementById('show-totals');

// Set Chat reader
let reader = new Chatbox.default();
reader.readargs = {
  colors: [
    A1lib.mixColor(30, 255, 0), // Main/very common wildy reward color (green)
    A1lib.mixColor(102, 152, 255), // Common wildy reward color (blue)
    A1lib.mixColor(163, 53, 238), // Uncommon wildy reward color (purple)
    A1lib.mixColor(255, 128, 0), // Rare wildy reward color (orange)
    // A1lib.mixColor(127,169,255), // Test Chat text color
  ],
  backwards: true,
};

// Setup main storage variables
util.createLocalStorage(DATA_STORAGE);
let saveData = util.getLocalStorage(DATA_STORAGE) || [];
util.createSessionStorage(CHAT_SESSION);
let saveChatHistory = util.getSessionStorage(CHAT_SESSION) || [];
if (!util.getLocalStorage(DISPLAY_MODE)) util.setLocalStorage(DISPLAY_MODE, 'history');

// CUSTOM: Setup additional storage variables
let wildSackOpened = parseInt(util.getLocalStorage(`${APP_PREFIX}WildSackOpened`)) || 0;
let veryWildSackOpened = parseInt(util.getLocalStorage(`${APP_PREFIX}VeryWildSackOpened`)) || 0;
let wyrmGlandOpened = parseInt(util.getLocalStorage(`${APP_PREFIX}WyrmGlandOpened`)) || 0;

// Find all visible chatboxes on screen
if (!window.alt1) {
  $('#item-list').html(`<p style="text-indent:1em">Alt1 not detected. <a href='alt1:// Addapp/${appURL}appconfig.json'>Click here to add the app to Alt1</a></p>`);
} else {
  $('#item-list').html('<p style="text-indent:1em">Searching for chatboxes...</p>');
}
window.addEventListener('load', function () {
  reader.find();
  reader.read();
})

let findChat = setInterval(function () {
  if (reader.pos === null)
    reader.find();
  else {
    clearInterval(findChat);
    reader.pos.boxes.map((box, i) => {
      $('.chat').append(`<option value=${i}>Chat ${i}</option>`);
    });
    const selectedChat = localStorage.getItem(SELECTED_CHAT);
    if (selectedChat) {
      reader.pos.mainbox = reader.pos.boxes[selectedChat];
    } else {
      // If multiple boxes are found, this will select the first, which should be the top-most chat box on the screen
      reader.pos.mainbox = reader.pos.boxes[0];
      localStorage.setItem(SELECTED_CHAT, 0);
    }
    showSelectedChat(reader.pos);
    // Build table from saved data, start tracking
    showItems();
    setInterval(function () {
      readChatbox();
    }, 300);
  }
}, 1000);

function showSelectedChat(chat) {
  // Attempt to show a temporary rectangle around the chatbox, skip if overlay is not enabled
  try {
    alt1.overLayRect(
      appColor,
      chat.mainbox.rect.x,
      chat.mainbox.rect.y,
      chat.mainbox.rect.width,
      chat.mainbox.rect.height,
      2000,
      5
    );
  } catch { }
}

// Reading and parsing info from the chatbox
function readChatbox() {
  let opts = reader.read() || [];
  let chat = '';
  // Additional options to ignore adding to coin pouch and removing commas
  const ignoreLine = /\[\d+:\d+:\d+\] \d*,?\d* coins have been added to your money pouch.\s?/g;
  for (let a in opts) {
    chat += opts[a].text.replace(ignoreLine, '').replace(',', '') + ' ';
  }
  // DEBUG: Uncomment to see chat and opts in console
  if (chat.length || opts.length) {
    console.log('Opts: ', opts);
    console.debug('Chat:', chat);
  }
  // Check if the chat message contains any of the following strings
  const found = [
    chat.indexOf('You open the ') > -1,
  ];

  const foundReward = found[0];
  if (found.includes(true)) {
    if (foundReward) {
      const regex = /(\[\d+:\d+:\d+\]) You open the (sack of wild rewards|sack of very wild rewards|wyrm reward gland) and receive: \s?((?:\1 \d+ x [\w\s()]+ ?)+)/g
      const itemRegex = /\[\d+:\d+:\d+\] (\d* x )([A-Za-z\s'\-!()\d]*)/g;
      const rewardRegex = new RegExp(regex.source);
      // Remove commas for 1k+ rewards
      const rewards = chat.match(regex);
      console.log(rewards)
      let counter = null;
      rewards.forEach((reward) => {
        const newReward = reward.match(rewardRegex);
        const source = newReward[2];
        const items = newReward[3].match(itemRegex);
        switch (source) {
          case 'sack of wild rewards':
            counter = `${APP_PREFIX}WildSackOpened`;
            break;
          case 'sack of very wild rewards':
            counter = `${APP_PREFIX}VeryWildSackOpened`;
            break;
          case 'wyrm reward gland':
            counter = `${APP_PREFIX}WyrmGlandOpened`;
            break;
        }
        saveMultipleItems(items, itemRegex, source, counter);
      });
    } else {
      console.warn('Unknown source');
      return;
    }
  }
}

// Save single item
function saveSingleItem(match, regex, source, counter) {
  if (counter && !saveChatHistory.includes(match)) {
    increaseCounter(counter);
  }

  saveItem(regex, match, source);
}

// In case of possible multiple items, save them all
function saveMultipleItems(match, regex, source, counter) {
  const filtered = filterItems(match, regex);
  const alreadySaved = filtered.some(item => saveChatHistory.includes(item));

  if (counter && !alreadySaved) {
    increaseCounter(counter);
  }
  filtered.forEach((item) => {
    saveItem(regex, item, source)
  });
}

// Add together all items of the same type
function filterItems(items, regex) {
  // Adjust regex to remove any flags
  const cleanRegex = new RegExp(regex.source);
  const filteredItemsMap = items.reduce((acc, itemString) => {
    const match = itemString.match(cleanRegex);
    if (match) {
      const itemName = match[2].trim();
      const quantityMatch = match[1] ? match[1].match(/\d+/) : ['1'];
      const quantity = parseInt(quantityMatch[0], 10);

      if (acc[itemName]) {
        acc[itemName] += quantity;
      } else {
        acc[itemName] = quantity;
      }
    }
    return acc;
  }, {});

  // Then, create a new array with updated quantities for each item
  const updatedItemsArray = items.map(itemString => {
    const match = itemString.match(cleanRegex);
    if (match) {
      const itemName = match[2].trim();
      const totalQuantity = filteredItemsMap[itemName];
      // Replace the quantity in the original string
      return itemString.replace(/(?: x (\d+))|(?:(\d+) x )/, (match, group1, group2) => {
        const digit = group1 || group2;
        return match.replace(digit, totalQuantity);
      });
    }
    return itemString;
  });
  // Update the saveChatHistory with the original item that was modified
  items.forEach(item => {
    if (!updatedItemsArray.includes(item) && !saveChatHistory.includes(item)) {
      saveChatHistory.push(item);
    }
  });
  return updatedItemsArray;
}

// Function to increase the counter in local storage
function increaseCounter(counter) {
  let num = parseInt(localStorage.getItem(counter)) || 0;
  num += 1;
  localStorage.setItem(counter, num);
  // Trigger event to update the counter variable -> see bottom part of the script
  dispatchEvent(new StorageEvent('storage', { key: counter }));
}

function saveItem(regex, item, src) {
  // Adjust regex to remove any flags
  const cleanRegex = new RegExp(regex.source);
  if (saveChatHistory.includes(item)) {
    console.debug('Duplicate:', item);
    return;
  }
  saveChatHistory.push(item);
  util.setSessionStorage(CHAT_SESSION, saveChatHistory);

  const reward = item.match(cleanRegex);
  const date = new Date();

  const itemName = reward[2].trim();
  const itemAmount = !reward[1] ? 1 : reward[1].match(/\d+/);
  const itemSource = src || APP_PREFIX;
  const itemTime = date.toISOString();

  const getItem = {
    item: `${itemAmount} x ${itemName}`,
    source: itemSource,
    time: itemTime
  };
  console.log(getItem);
  saveData.push(getItem);
  util.setLocalStorage(DATA_STORAGE, saveData);
  showItems();
}

// Function to determine the total of all items recorded
function getTotal(source) {
  let total = {};
  saveData.forEach(item => {
    if (item.source === source || source === undefined) {
      const data = item.item.split(' x ');
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

// Function to display totals on top of the list
function displayTotal(text, total) {
  $('#item-list').append(`<li style="color:${rgbColor}">${text}: <strong>${total}</strong></li>`);
}

// Function to create a list of all items and their totals
function createList(total, type) {
  if (type === 'history') {
    saveData.slice().reverse().map(item => {
      $('#item-list').append(
        `<li title="From: ${item.source} @ ${util.formatDateTime(item.time)}">${item.item}</li>`
      )
    })
  } else {
    Object.keys(total).sort().forEach(item => $('#item-list').append(
      `<li>${item}: ${total[item].toLocaleString()}</li>`
    ))
  }
}

function showItems() {
  $('#item-list').empty();

  let display = util.getLocalStorage(DISPLAY_MODE) || 'history';
  let total = getTotal();
  let text = 'Total Opened';
  let type = null

  // TODO: Change layout with tabs, so this code can be removed
  switch (display) {
    case 'total': {
      $('#item-list').append(`<li data-show="history" title="Click to show Reward History">Reward Item Totals</li>`);
    }
      break;
    case 'history': {
      $('#item-list').append(`<li data-show="wild-sack" title="Click to show Wild Sack Totals">Reward History</li>`);
      type = 'history';
    }
      break;
    // CUSTOM: Additional displays for custom sources
    case 'wild-sack': {
      $('#item-list').append(`<li data-show="very-wild-sack" title="Click to show Very Wild Sack Totals">Wild Sack Reward Totals</li>`);
      total = getTotal('sack of wild rewards');
      text = 'Wild Sacks Opened';
    }
      break;
    case 'very-wild-sack': {
      $('#item-list').append(`<li data-show="wyrm-gland" title="Click to show all Wyrm Reward Gland Totals">Very Wild Sack Drop Totals</li>`);
      total = getTotal('sack of very wild rewards');
      text = 'Very Wild Sacks Opened';
    }
      break;
    case 'wyrm-gland': {
      $('#item-list').append(`<li data-show="total" title="Click to show all Reward Totals">Wyrm Reward Gland Totals</li>`);
      total = getTotal('wyrm reward gland');
      text = 'Wyrm Glands Opened';
    }
      break;
  }
  if (showTotals.checked) {
    let totalRewards = wildSackOpened + veryWildSackOpened + wyrmGlandOpened;
    // CUSTOM: Additional totals for custom sources
    if (display !== 'total' && display !== 'history') {

      switch (display) {
        case 'wild-sack':
          totalRewards = wildSackOpened;
          break;
        case 'very-wild-sack':
          totalRewards = veryWildSackOpened;
          break;
        case 'wyrm-gland':
          totalRewards = wyrmGlandOpened;
          break;
      }
    }

    displayTotal(text, totalRewards);
  }

  createList(total, type);
}

// Create content for CSV
function createExportData(type) {
  let str = 'Item,Qty\n';
  let total = getTotal();
  switch (type) {
    case 'total':
      break;
    case 'history':
      str = 'Item,Source,Date,Time\n';
      break;
    // CUSTOM: Additional exports for custom sources
    case 'wild-sack':
      total = getTotal('sack of wild rewards');
      break;
    case 'very-wild-sack':
      total = getTotal('sack of very wild rewards');
      break;
    case 'wyrm-gland':
      total = getTotal('wyrm reward gland');
      break;
    // End custom
    default: {
      console.warn('Display mode:', util.getLocalStorage(DISPLAY_MODE));
      throw new Error('Unknown display mode');
    }
  }

  if (type === 'history') {
    saveData.forEach((item) => {
      str += `${item.item},${item.source},${util.formatDateTime(item.time)}\n`;
    });
  } else {
    Object.keys(total).sort().forEach(item => str += `${item},${total[item]}\n`);
  }
  return str;
}

// Event listeners

$(function () {

  // Changing which chatbox to read
  $('.chat').change(function () {
    reader.pos.mainbox = reader.pos.boxes[$(this).val()];
    showSelectedChat(reader.pos);
    localStorage.setItem(SELECTED_CHAT, $(this).val());
    $(this).val('');
  });

  // Export current overview to CSV-file
  $('.export').click(function () {
    const exportDate = new Date();
    const downloadDate = util.formatDownloadDate(exportDate);
    const display = util.getLocalStorage(DISPLAY_MODE);
    const csv = createExportData(display);
    let fileName;

    switch (display) {
      case 'total':
        fileName = `${APP_PREFIX}TotalExport_${downloadDate}.csv`;
        break;
      case 'history':
        fileName = `${APP_PREFIX}HistoryExport_${downloadDate}.csv`;
        break;
      // CUSTOM: Additional exports names for custom sources
      case 'wild-sack':
        fileName = `${APP_PREFIX}WildSackTotalExport_${downloadDate}.csv`;
        break;
      case 'very-wild-sack':
        fileName = `${APP_PREFIX}VeryWildSackTotalExport_${downloadDate}.csv`;
        break;
      case 'wyrm-gland':
        fileName = `${APP_PREFIX}WyrmGlandTotalExport_${downloadDate}.csv`;
        break;
      default:
    }

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    util.downloadFile(blob, fileName);
  });

  // Factory reset
  $('.clear').click(function () {
    util.deleteLocalStorage(DATA_STORAGE, SELECTED_CHAT, DISPLAY_MODE, `${TOTALS_PREFIX}hide`, `${TOTALS_PREFIX}show`);
    util.deleteSessionStorage(CHAT_SESSION);
    // CUSTOM: Additional storage keys to clear
    util.deleteLocalStorage(`${APP_PREFIX}WildSackOpened`, `${APP_PREFIX}VeryWildSackOpened`, `${APP_PREFIX}WyrmGlandOpened`);
    $('#show-totals').prop('checked', true);

    location.reload();
  })

  // Toggle display mode
  $(document).on('click', 'li:first-child', function () {
    util.setLocalStorage(DISPLAY_MODE, `${$(this).data('show')}`);
    showItems()
  })
});

// Toggle totals display
$(function () {
  $('[data-totals]').each(function () {
    $(this).click(showItems);
  });

  $('[data-totals]').each(function () {
    let state = util.getLocalStorage(`${TOTALS_PREFIX}${$(this).data('totals')}`);
    if (state) this.checked = state.checked;
  });
});


$(window).bind('unload', function () {
  $('[data-totals]').each(function () {
    const key = `${TOTALS_PREFIX}${$(this).data('totals')}`;
    const value = { checked: this.checked };

    util.setLocalStorage(key, value);
  });
});

// Event listener to check if data has been altered
window.addEventListener('storage', function (e) {
  let dataChanged = false;
  switch (e.key) {
    case DATA_STORAGE: {
      let changedData = util.getLocalStorage(DATA_STORAGE);
      let lastChange = changedData[changedData.length - 1];
      let lastSave = [saveData[saveData.length - 1]]
      if (lastChange != lastSave) {
        saveData = changedData;
        dataChanged = true;
      }
    }
      break;
    // CUSTOM: Additional storage keys to check for changes in count
    case `${APP_PREFIX}WildSackOpened`: {
      let changedSacks = parseInt(util.getLocalStorage(`${APP_PREFIX}WildSackOpened`));
      if (wildSackOpened != changedSacks) {
        wildSackOpened = changedSacks;
        dataChanged = true;
      }
    }
      break;
    case `${APP_PREFIX}VeryWildSackOpened`: {
      let changedSacks = parseInt(util.getLocalStorage(`${APP_PREFIX}VeryWildSackOpened`));
      if (veryWildSackOpened != changedSacks) {
        veryWildSackOpened = changedSacks;
        dataChanged = true;
      }
      break;
    }
    case `${APP_PREFIX}WyrmGlandOpened`: {
      let changedSacks = parseInt(util.getLocalStorage(`${APP_PREFIX}WyrmGlandOpened`));
      if (wyrmGlandOpened != changedSacks) {
        wyrmGlandOpened = changedSacks;
        dataChanged = true;
      }
      break;
    }
  }

  if (dataChanged) {
    showItems();
  }
  console.debug('Data changed:', e.key);
});

// Force read chatbox
A1lib.on('alt1pressed', readChatbox);