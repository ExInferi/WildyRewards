//Enable "Add App" button for Alt1 Browser.
A1lib.identifyApp("appconfig.json");

const appColor = A1lib.mixColor(255, 102, 0);

// Set Chat reader
let reader = new Chatbox.default();
reader.readargs = {
  colors: [
    A1lib.mixColor(255, 102, 0), //Pumpkin text color
    // A1lib.mixColor(127,169,255), //Test Chat text color
  ],
  backwards: true,
};

//Setup localStorage variable.
if (!localStorage.pumpkinData) {
  localStorage.setItem("pumpkinData", JSON.stringify([]))
}
if (!localStorage.pumpkinDisplay) {
  localStorage.setItem("pumpkinDisplay", "history")
}
let saveData = JSON.parse(localStorage.pumpkinData);

//Find all visible chatboxes on screen
$(".itemList").append("<li class='list-group-item'>Searching for chatboxes</li>");
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
      $(".chat").append(`<option value=${i}>Chat ${i}</option>`);
    });

    if (localStorage.pumpkinChat) {
      reader.pos.mainbox = reader.pos.boxes[localStorage.pumpkinChat];
    } else {
      //If multiple boxes are found, this will select the first, which should be the top-most chat box on the screen.
      reader.pos.mainbox = reader.pos.boxes[0];
    }
    showSelectedChat(reader.pos);
    //build table from saved data, start tracking.
    showItems();
    setInterval(function () {
      readChatbox();
    }, 10);
  }
}, 1000);

function showSelectedChat(chat) {
  //Attempt to show a temporary rectangle around the chatbox.  skip if overlay is not enabled.
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
  } catch {}
}
let lastPumpkinDetected;
//Reading and parsing info from the chatbox.
function readChatbox() {
  var opts = reader.read() || [];
  var chat = "";

  for (a in opts) {
    chat += opts[a].text + " ";
  }

  if (chat.indexOf("Pumpkin gifts you") > -1) {
    let currentPumpkinDetected = chat.match(/\[\d+:\d+:\d+\] The (Party|Smashing) Pumpkin gifts you : (\d+ x [A-Za-z\s-':()1-4]+)/);
    if (currentPumpkinDetected[0].trim() === lastPumpkinDetected) {
      return;
    }
    console.log(currentPumpkinDetected);

    lastPumpkinDetected = currentPumpkinDetected[0].trim();

    let getItem = {
      //  item: chat.match(/\d+ x [A-Za-z\s-'()1-4]+/)[0].trim(),
      item: currentPumpkinDetected[2].trim(),
      source: `${currentPumpkinDetected[1].trim()} Pumpkin`,
      time: new Date()
    };
    console.log(getItem);
    saveData.push(getItem);
    localStorage.setItem("pumpkinData", JSON.stringify(saveData));
    checkAnnounce(getItem);
    showItems();
  }
}

function showItems() {
  $(".itemList").empty();
  let pumpkinsSmashing = 0;
  let pumpkinsParty = 0;
  let showTotals = document.getElementById("show-totals");

  if (showTotals.checked) {
    saveData.forEach(item => {
      if (item.source === "Smashing Pumpkin") {
        pumpkinsSmashing++;
      } else if (item.source === "Party Pumpkin") {
        pumpkinsParty++;
      }
    });

  }
  let pumpkinsTotal = pumpkinsParty + pumpkinsSmashing;
  let display = localStorage.getItem("pumpkinDisplay");

  if (display === "total") {
    $(".itemList").append(`<li class="list-group-item header" data-show="history" title="Click to show Pumpkin History">Pumpkin Item Totals</li>`);
    let total = getTotal();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item pumpkin">Total Pumpkins: <strong>${pumpkinsTotal}</strong></li>`);
    }
    Object.keys(total).sort().forEach(item => $(".itemList").append(`<li class="list-group-item">${item}: ${total[item]}</li>`))
  } else if (display === "history") {
    $(".itemList").append(`<li class="list-group-item header" data-show="smashing" title="Click to show Smashing Pumpkin Totals">Pumpkin Item History</li>`);
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item pumpkin">Total Pumpkins: <strong>${pumpkinsTotal}</strong></li>`);
    }
    saveData.slice().reverse().map(item => {
      $(".itemList").append(`<li class="list-group-item" title="From: ${item.source} @ ${new Date(item.time).toLocaleString()}">${item.item}</li>`)
    })
  } else if (display === "smashing") {
    $(".itemList").append(`<li class="list-group-item header" data-show="party" title="Click to show Party Pumpkin Totals">Smashing Pumpkin Totals</li>`);
    let totalSmashing = getTotalSmashing();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item pumpkin">Total Smashing Pumpkins: <strong>${pumpkinsSmashing}</strong></li>`);
    }
    Object.keys(totalSmashing).sort().forEach(item => {
      $(".itemList").append(`<li class="list-group-item">${item}: ${totalSmashing[item]}</li>`)
    })
  } else if (display === "party") {
    $(".itemList").append(`<li class="list-group-item header" data-show="total" title="Click to show all Pumpkin Totals">Party Pumpkin Totals</li>`);
    let totalParty = getTotalParty();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item pumpkin">Total Party Pumpkins: <strong>${pumpkinsParty}</strong></li>`);
    }
    Object.keys(totalParty).sort().forEach(item => {
      $(".itemList").append(`<li class="list-group-item">${item}: ${totalParty[item]}</li>`)
    })
  }
}




function checkAnnounce(getItem) {
  if (localStorage.pumpkinAnnounce) {
    fetch(localStorage.getItem("pumpkinAnnounce"), {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: "Pumpkin Tracker",
        content: `${new Date(getItem.time).toLocaleString()}: Received - ${getItem.item}`
      })
    })
  }
}

//Function to determine the total of all items recorded.
function getTotal() {
  let total = {};
  saveData.forEach(item => {
    data = item.item.split(" x ");
    total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
  })
  return total;
}

function getTotalSmashing() {
  let total = {};
  saveData.forEach(item => {
    if (item.source === "Smashing Pumpkin") {
      data = item.item.split(" x ");
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

function getTotalParty() {
  let total = {};
  saveData.forEach(item => {
    if (item.source === "Party Pumpkin") {
      data = item.item.split(" x ");
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

$(function () {

  $(".chat").change(function () {
    reader.pos.mainbox = reader.pos.boxes[$(this).val()];
    showSelectedChat(reader.pos);
    localStorage.setItem("pumpkinChat", $(this).val());
    $(this).val("");
  });

  $(".export").click(function () {
    var exportDate = new Date();
    var downDate = exportDate.getFullYear().toString() + "-" + (exportDate.getMonth() + 1).toString() + "-" + exportDate.getDate().toString();
    var downTime = exportDate.getHours().toString() + "-" + (exportDate.getMinutes() + 1).toString() + "-" + exportDate.getSeconds().toString();
    var str, fileName;

    //count all pumpkins
    let pumpkinsSmashing = 0;
    let pumpkinsParty = 0;
    saveData.forEach(item => {
      if (item.source === "Smashing Pumpkin") {
        pumpkinsSmashing++;
      } else if (item.source === "Party Pumpkin") {
        pumpkinsParty++;
      }
    });
    let pumpkinsTotal = pumpkinsParty + pumpkinsSmashing;

    //If totals is checked, export totals
    if (localStorage.getItem("pumpkinDisplay") === "total") {
      str = `Item,Qty\nTotal smashing pumpkins,${pumpkinsSmashing}\nTotal party pumpkins,${pumpkinsParty}\nTotal combined pumpkins,${pumpkinsTotal}\n`;
      let total = getTotal();
      Object.keys(total).sort().forEach(item => str = `${str}${item},${total[item]}\n`);
      fileName = `pumpkinTotalExport_${downDate}_${downTime}.csv`;

      // export list by item and time received.
    } else if (localStorage.getItem("pumpkinDisplay") === "history") {
      str = `Item,Source,Date,Time\n${pumpkinsSmashing} x Total Smashed,Smashing Pumpkin,${exportDate.toLocaleDateString()},${exportDate.toLocaleTimeString()}\n${pumpkinsParty} x Total Smashed,Party Pumpkin,${exportDate.toLocaleDateString()},${exportDate.toLocaleTimeString()}\n${pumpkinsTotal} x Total Smashed,All Pumpkins,${exportDate.toLocaleDateString()},${exportDate.toLocaleTimeString()}\n`;
      // making sure all items have a source, as the first version didn't save the source seperately 
      saveData.forEach((item) => {
        if (item.source == undefined) {
          item.source = "Smashing Pumpkin";
        }
        str = `${str}${item.item},${item.source},${new Date(item.time).toLocaleString()}\n`;
      });
      fileName = `pumpkinHistoryExport_${downDate}_${downTime}.csv`;

      //export total smashing pumpkins
    } else if (localStorage.getItem("pumpkinDisplay") === "smashing") {
      str = "Item,Qty\n";
      let totalSmashing = getTotalSmashing();
      Object.keys(totalSmashing).sort().forEach(item => str = `${str}${item},${totalSmashing[item]}\n`);
      str += `Total pumpkins,${pumpkinsSmashing}`;
      fileName = `pumpkinSmashingTotalExport_${downDate}_${downTime}.csv`;

      //export total party pumpkins 
    } else if (localStorage.getItem("pumpkinDisplay") === "party") {
      str = "Item,Qty\n";
      let totalParty = getTotalParty();
      Object.keys(totalParty).sort().forEach(item => str = `${str}${item},${totalParty[item]}\n`);
      str += `Total pumpkins,${pumpkinsParty}`;
      fileName = `pumpkinPartyTotalExport_${downDate}_${downTime}.csv`;
    }

    var blob = new Blob([str], {
      type: "text/csv;charset=utf-8;"
    });
    if (navigator.msSaveBlob) {
      // IE 10+
      navigator.msSaveBlob(blob, fileName);
    } else {
      var link = document.createElement("a");
      if (link.download !== undefined) {
        // feature detection
        // Browsers that support HTML5 download attribute
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  });

  $(".clear").click(function () {
    localStorage.removeItem("pumpkinData");
    localStorage.removeItem("pumpkinChat");
    localStorage.removeItem("pumpkinDisplay")
    localStorage.removeItem("totals_hide-totals")
    localStorage.removeItem("totals_show-totals");
    $("#show-totals").prop("checked", true);

    location.reload();
  })

  $(document).on("click", ".header", function () {
    localStorage.setItem("pumpkinDisplay", $(this).data("show"));
    showItems()
  })
});

$(function () {
  $('input[type=radio]').each(function () {
    var state = JSON.parse(localStorage.getItem('totals_' + this.id));
    if (state) this.checked = state.checked;
  });
});

$(window).bind('unload', function () {
  $('input[type=radio]').each(function () {
    localStorage.setItem('totals_' + this.id, JSON.stringify({
      checked: this.checked
    }));
  });
});



// Event listener to check if data has been altered
window.addEventListener('storage', function (e) {
  if (e.key === "pumpkinData") {

    let changedData = JSON.parse(localStorage.pumpkinData);
    let lastChange = changedData[changedData.length - 1];
    let lastSave = [saveData[saveData.length - 1]]
    
    if (lastChange != lastSave) {
      saveData = changedData;
      showItems();}
    }
});
