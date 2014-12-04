﻿'use strict';

var fs = require('fs');

Date.prototype.yyyymmdd = function () {
    var yyyy = this.getFullYear().toString();
    var mm = (this.getMonth() + 1).toString(); // getMonth() is zero-based
    var dd = this.getDate().toString();
    return yyyy + '-'+(mm[1] ? mm : "0" + mm[0])+ '-' + (dd[1] ? dd : "0" + dd[0]); // padding
};


var vm = require('vm');
var includeInThisContext = function (path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
}.bind(this);
includeInThisContext('tongwen_core.js');
includeInThisContext('tongwen_table_t2s.js');

var toASCII = function(chars) {
    var ascii = '';
    for(var i=0, l=chars.length; i<l; i++) {
        var c = chars[i].charCodeAt(0);

        // make sure we only convert half-full width char
        if (c >= 0xFF00 && c <= 0xFFEF) {
           c = 0xFF & (c + 0x20);
        }

        ascii += String.fromCharCode(c);
    }

    return ascii;
}

var ParseLineData = function(data)
      {
          var lineData = [];
	for (var i = 0; i < 8; i++) lineData[i] = '';
          var who = 0;
          var prevChar = ' ';
          for (var i = 0; i < data.length; i++)
          {
		var d = data[i];
              if (who < lineData.length) lineData[who] = d;
              if (who > 0)
              {
                  var c = d[0];
                  if (c >= '0' && c <= '9')
                  {
                      lineData[who - 1] += d;
                      continue;
                  }                 
                  if (c == ',')
                  {
                      lineData[who - 1] += c;
                      prevChar = c;
                      continue;
                  }
                  if (prevChar == ',')
                  {
                      lineData[who - 1] += c;
                  }
                  prevChar = c;
              }
              who++;
          }
          return lineData;
      };

var _MS_PER_DAY = 1000 * 60 * 60 * 24;

// a and b are javascript Date objects
function dateDiffInDays(a, b) {
    // Discard the time and time-zone information.
    var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

var GetTodaysSearch = function (data, today) {
    var retResult = {
        Verses: []
    };
    var results = retResult.Verses;
    var lines = data.split('\n');
    var startDate = new Date(Date.parse(toASCII(lines[0].substring(1))));
    
    var days = dateDiffInDays(startDate, today);
    if (days < 0) return null;
    var DAYS_PER_LINE = 7;
    var curLinePos = 1;
    //for (var i = 0; i <= (days / DAYS_PER_LINE); i++)
    {
        //if (curLinePos >= lines.length) break;
        var curLineDay = Math.round(days / DAYS_PER_LINE) + 1;
        var curLine = lines[curLineDay].trim();
        var day = days % DAYS_PER_LINE;
        var lineData = ParseLineData(curLine.split(/[\s\t]+/));
        var curdata1 = lineData[day + 1];
        retResult.Subject = curdata1;
        var curdataparts = curdata1.split(/[,]+/);

        for (var curdataii in curdataparts) {
            var curdata = curdataparts[curdataii];
            var numStart = 0;
            for (; numStart < curdata.length; numStart++) {
                if (!isNaN(curdata[numStart])) {
                    break;
                }
            }
            var bookName = curdata.substring(0, numStart);
            var numbers = curdata.substring(numStart);
            //formats: book#-#
            //         book#:#-#
            //         book #(#/#)
            if (numbers.indexOf(":") > 0) {
                var verse = numbers.substring(0, numbers.indexOf(":"));
                numbers = numbers.substring(numbers.indexOf(":") + 1);
                if (numbers.indexOf("-") > 0) {
                    var numberary = numbers.split('-');
                    var fromVer = parseInt(numberary[0]);
                    var toVer = parseInt(numberary[1]);
                    for (var num = fromVer; num <= toVer; num++) {
                        results.push({ Verse: bookName + verse + ":" + num + " " });
                    }
                }
                else {
                    results.push({ Verse: curdata });
                }
            } else
                if (numbers.indexOf("-") > 0) {
                    var numberary = numbers.split('-');
                    var fromVer = parseInt(numberary[0]);
                    var toVer = parseInt(numberary[1]);
                    for (var num = fromVer; num <= toVer; num++) {
                        results.push({ Verse: bookName + num });
                    }
                }
                else if (numbers.indexOf("(") > 0) {
                    var pt =
                        {
                            Verse: bookName + numbers.substring(0, numbers.indexOf("("))
                        };
                    var partialStr = numbers.substring(numbers.indexOf("("));
                    var startNTotal = partialStr.split(/[\(/\)]/);
                    pt.Part = parseInt(startNTotal[0]);
                    pt.Total = parseInt(startNTotal[1]);
                    results.push(pt);
                }
                else {
                    results.push({ Verse: curdata });
                }
        }



    }
    for (var rii in results) {
        var r = results[rii];
        if (r.Verse.indexOf(":") >= 0) continue;
        var lastChar = r.Verse[r.Verse.length - 1];
        if (lastChar >= '0' && lastChar <= '9')
            r.Verse += ":";
    };
    return retResult;
};


var GetOutput = function (all, shows) {
    var result = [];
    var sb = '';
    for (var showi in shows) {
        var show = shows[showi];
        result = [];
        for (var ti in all) {
            var t = all[ti];
            if (t.indexOf(show.Verse) == 0) {
                result.push(t);
            }
        }
        var startLimit = 0;
        var endLimit = result.length;
        if (show.Part != 0) {
            startLimit = (show.Part - 1) * result.length / show.Total;
            endLimit = (show.Part) * result.length / show.Total;
            if (show.Part == result.length) endLimit++;
        }
        for (var i = 0; i < result.length; i++) {
            if (i < startLimit) continue;
            if (i >= endLimit) continue;
            var t = result[i];
            sb += (t) + ("\r\n");
        }
    }
    return sb;
};

var loadData = function (today) {
    var scdata = fs.readFileSync('schedule.txt', 'utf8', function (err) {
        if (err) console.log('schedule.txt error ' + err);
    });
    var searches = GetTodaysSearch(scdata, today);
    if (searches === null) return null;

    var bibleData = fs.readFileSync('bibleUTF8.txt', 'utf8', function (err) {
        if (err) console.log('bibleutf error ' + err);
    }).split('\n');    
    
    var ret = {};
    var data = GetOutput(bibleData, searches.Verses);
    if (searches.Subject === null) return null;
    var simpSub = TongWen.trans2Simp(searches.Subject);
    if (simpSub == searches.Subject) {
        ret.Subject = searches.Subject;
    }
    else {
        ret.Subject = simpSub + ' (' + searches.Subject + ')';
    }
    ret.Data = "===========简体中文=============\r\n" + TongWen.trans2Simp(data) + "\r\n===========繁体中文=============\r\n" + data;
    return ret;

};


//var resss = loadData(new Date());
//console.log(resss.Data);

var SendEmail = function(now)
{
    var data = loadData(now);
    var message = {};
    var sendTo = ''; //GetSetting("mailTo");
    
    message.subject = data.Subject + ', ' + now.yyyymmdd();
    console.log('sending ' + message.subject);
    //message.BodyEncoding = System.Text.Encoding.UTF8;
    message.text = data.Data;
    //Log(now.ToString("yyyy-MM-dd") + " " + sendTo + " " + message.Subject);         
    //SendMailDefaultFrom(message);
    //using (var sw = File.CreateText(@"c:\temp\bible\" + message.Subject.Replace("/", "_").Replace("\\", "_").Replace("<", "_").Replace(">", "_").Replace(":", "_").Replace("|", "_") + ".txt"))
    //{
    //    sw.WriteLine(data.Data);
    //}

    var mandrill = require('mandrill-api/mandrill');
    var mandrill_client = new mandrill.Mandrill('xgTWejYD9NOZjNEG2SJMbQ', true);

    var async = false;
    var ip_pool = "Main Pool";
    var send_at = "example send_at";
    message.from_email = "gzhangx@gmail.com";
    message.from_name = "Gang Zhang";
    message.to = [{
        "email": "hebrewsofacccn@googlegroups.com",
        //"name": "Test",
        "type": "to"
    }];
    mandrill_client.messages.send({ "message": message, "async": async, "ip_pool": ip_pool}, function (result) {
        console.log(result);        
    }, function (e) {
        // Mandrill returns the error as an object with name and message keys
        console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
        // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
    });
    return data.subject;
}

function DoMailSendCheckSendStatus(now)
{
    var sentFileName = 'sent.txt';
    var date = now.yyyymmdd();
    var sendStatusFile = '';
    if (fs.existsSync(sentFileName)) {
        sendStatusFile = fs.readFileSync(sentFileName).toString().split('\n');
        if (sendStatusFile.length > 0) {
            for (var i = 1; i <= sendStatusFile.length ; i++) {
                if (sendStatusFile[sendStatusFile.length - i].indexOf(date) >= 0) {
                    return;
                }
                if (i > 3) break;
            }
        }
    }
    var sub = SendEmail(now);
    fs.appendFileSync(sentFileName, date + '   ' + sub + '\r\n', 'utf8');
}

DoMailSendCheckSendStatus(new Date());