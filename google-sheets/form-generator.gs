var spreadsheetTitle = 'Community Vote - presentations';
var title = 'FOSS4G SotM Oceania Presentations Community Vote';
var description = 'Below are the potential full-length presentations available for the FOSS4G SotM Oceania conference on Wednesday and Thursday, November 13-14th, 2019 in Wellington, New Zealand. Each presentation will be about 18 minutes long (including time for a few questions and answers). Please make your voice heard and vote for each of the possible presentations. After the voting period closes, the votes will be tallied and the presentations announced.';
function talkFilter(talk){ return talk.type == 'Talk'; };
function getTitle(talk){ return talk.title; };
function getAbstract(talk){ return talk.abstract; };


function getSpreadsheetData(sheetName) {
  // This function gives you an array of objects modeling a worksheet's tabular data, where the first items — column headers — become the property names.
  var arrayOfArrays = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName || spreadsheetTitle).getDataRange().getValues();
  var headers = arrayOfArrays.shift();
  return arrayOfArrays.map(function (row) {
    console.log(row);
    return row.reduce(function (memo, value, index) {
      if (value) {
        memo[headers[index]] = value;
      }
      return memo;
    }, {});
  });
}

function makeOurForm() {
  var form = FormApp.create(title);
  form.setTitle(title);
  form.setDescription(description);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(false);
  //form.setRequireLogin(false);
  form.setConfirmationMessage('Thanks for voting!');

  getSpreadsheetData().forEach(function (row) {
    if (!talkFilter(row)) { return; }
    var sectionHeader = form.addSectionHeaderItem();
    sectionHeader.setTitle(getTitle(row));
    sectionHeader.setHelpText(getAbstract(row));
    var item = form.addGridItem()
    .setRows([getTitle(row)])
    .setColumns(['Not interested', 'Interested', 'Very Interested']);
  });
}
