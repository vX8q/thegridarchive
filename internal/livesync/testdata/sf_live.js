
/*
    var uri = "<c:out value="${requestScope.streamlive}"/>" + "get";
    var sector = "<c:out value="${requestScope.sector}"/>";
    var speed = "<c:out value="${requestScope.speed}"/>";
    var circuit = "<c:out value="${requestScope.circuit}"/>";
*/
    var lang = "JP";
    var webSocket = null;
    var liveList = new Object();
    var dispclass = "all";
    var racemode = "B";
    let isLoop = true;





    var c = $.cookie("superformula");
    if( c != null ) {
        lang = c;
    } 
    var ua = navigator.userAgent;
    if (navigator.userAgent.indexOf('Android') > 0) {
        if (navigator.userAgent.indexOf('Chrome') < 0) {
            if ( parseFloat(navigator.userAgent.slice(ua.indexOf("Android")+8)) < 4.4 ) {
                alert("Android4.4以下の標準ブラウザは対応していません。Chromeブラウザを使用して下さい。");
            }
        }
    }

     window.addEventListener('load', () => {
         const storedValue = localStorage.getItem('isLoop');
         if (storedValue !== null) {
            isLoop = JSON.parse(storedValue);
         } else {
                 localStorage.setItem('isLoop', JSON.stringify(isLoop));
         }
         document.getElementById('toggleSwitch').checked = isLoop;
         updateLabelText(isLoop);
     });

     document.getElementById('toggleSwitch').addEventListener('change', function() {
         isLoop = this.checked;
         localStorage.setItem('isLoop', JSON.stringify(isLoop));
         updateLabelText(isLoop);
         location.reload();
     });


     function updateLabelText(isLoop) {
         const labelText = document.getElementById('labelText');
         if (isLoop == false) {
             labelText.textContent = "LapMode";
         } else {
             labelText.textContent = "SecMode";
         }
     }



    $(function(){

        $(window).focus();
        $(window).bind("focus",function(){
            //location.reload();
        }).bind("blur",function(){
        }); 
    });
		
    function init() {
        try{
            webSocket = new WebSocket(uri);
            webSocket.onopen = onOpen;
            webSocket.onmessage = onMessage;
            webSocket.onclose = onClose;
            webSocket.onerror = onError;
        }catch( e ){}
    }

    function onOpen(event) {
    }

    function onMessage(event) {
        if (event && event.data) {
            try{
                var j = $.parseJSON( event.data );
                setData(j);
            } catch( e ) {
                console.log(e);
            }
        }
    }

    function onError(event) {
    	document.getElementById('toggleContainer').classList.add('hidden');
    }

    function onClose(event) {
        webSocket = null;
        setTimeout("init()", 10);
    }

    function setData(j) {
           if( j.type == '0' ) {

            setListTitle();

            if( j.rows.length == 0 ) {
                return;
            }

            liveList = j.rows;
            for(var index in j.rows) {
                setRowData(j.rows[index]);
            }

            $('#Container').mixItUp('sort', 'sort:desc');
        } else if( j.type == 'R' ) {
            location.reload();
        } else if( j.type == '1' || j.type == '2' || j.type == '3' || j.type == 'L' || j.type == 'K') { // Passing
            
            if (j.STATUS == "G" && (j.type == '1' || j.type == '2' || j.type == '3')) {
                return;
            }
            setLineData(j);
          
            if (racemode != "B"){ 
                if ( !isLoop ) {
	            if( j.type == 'L' ) {
                        $('#Container').mixItUp('sort', 'sort:desc');
                    }
                } else {
                    if( j.type == '1' || j.type == '2' || j.type == '3' || j.type == 'L' ) {
                        $('#Container').mixItUp('sort', 'sort:desc');
                    }
                }
            } else {
                if( j.type == 'L' ) {
                    $('#Container').mixItUp('sort', 'sort:desc');
                }
            }




        } else if( j.type == 'U' ) { // UPDATE
            setLineData(j);
        } else if( j.type == 'I' ) { // PIT-IN
            setStatusData(j.CARNO,"P", j.PIT);
        } else if( j.type == 'O' ) { // PIT-OUT
            setStatusData(j.CARNO,"", "");
        } else if( j.type == 'D' ) { // DRIVER
            setDriverData(j);
        } else if( j.type == 'U' ) { // UPDATE
            setDriverData(j);
        } else if( j.type == 'S' ) { // SCHEDULE
                racemode = j.RACE_TYPE;
                $(".title").text(j.CATEGORY + " " + j.DESCR_J);
                var classList = j.CLASS_LIST.split(",");
                var liClass = '<ul class="classmenu" style="position:absolute;top:0px;left:230px;"><li class="current" id="class_all"><a href="javaScript:setFilter(\'all\');" data-hover="ALL">ALL</a></li>';
                for( i=0; i<classList.length; i++ ) {
                      liClass += '<li id="class_' + classList[i] + '"><a href="javaScript:setFilter(\'' + classList[i] + '\');" data-hover="' + classList[i] + '">' + classList[i] + '</a></li>';
                }
                liClass += '</ul>';

                $("#classfilter").html(liClass);
                setBestInfo(j);


                if (racemode == "B" || racemode == "") {
                    document.getElementById('toggleContainer').classList.add('hidden');
                }




        } else if( j.type == 'W' ) { // WEATHER
                $("#weather").attr("src","pages/images/" + j.weather + ".png");
                $("#condition").text(j.condition);
        } else if( j.type == 'T' ) { // TELOP
                $("#telop").text(j.msg);
        } else if( j.type == 'F' ) { // HARTBEAT
            if( racemode == "B" ) {
                if( j.flag == "F" ) {
                    $(".laps").text("FINISH");
                } else {
                    $(".laps").text(j.togo);
                }
            } else {
                if( j.flag == "F" ) {
                    $(".laps").text("FINISH");
                } else {
                    if( racemode == "R" ) {
                        $(".laps").text(j.togo+" LAPS TO GO");
                    } else {
                        $(".laps").text(j.togo);
                    }
                }
            }
            if( j.flag == "G" ) {
                $("#liveflag").attr("src","pages/images/green_on.png");
            } else if( j.flag == "R" ) {
                $("#liveflag").attr("src","pages/images/red_on.png");
            } else if( j.flag == "Y" ) {
                $("#liveflag").attr("src","pages/images/yellow_on.png");
            } else if( j.flag == "F" ) {
                $("#liveflag").attr("src","pages/images/cheker.png");
            } else {
                $("#liveflag").attr("src","pages/images/green_off.png");
            }
        }
    }

    $(init);

    function setFilter(category) {
        dispclass = category;
        if( category == "all" ) {
            $('#Container').mixItUp('filter', 'all');
        } else {
            $('#Container').mixItUp('filter', '.category-' + category);
        }

	    var list = $(".classmenu").children('li');

        for(var i=0; i < list.length; i++) {
            var liId = list.eq(i).attr('id').substr(6);
            if( liId == category ) {
                $('#class_' + liId).attr("class","current");
            } else {
                $('#class_' + liId).removeAttr("class");
            }
        }

    }

    function setLineData(data) {

        for(var index in liveList) {
            if( liveList[index].CARNO == data.CARNO ) {
                liveList[index] = data;
                if( data.type == 'U') {
                    $("#c" + liveList[index].CARNO + "_last").css('color', getLapColor(liveList[index].LAST_FLAG));
                    if( sector >= 2 ) {
                        $("#c" + liveList[index].CARNO + "_sec1").css('color', getLapColor(liveList[index].SEC1_FLAG));
                        $("#c" + liveList[index].CARNO + "_sec2").css('color', getLapColor(liveList[index].SEC2_FLAG));
                    }
                    if( sector >= 3 ) {
                        $("#c" + liveList[index].CARNO + "_sec3").css('color', getLapColor(liveList[index].SEC3_FLAG));
                    }
                    if( sector >= 4 ) {
                        $("#c" + liveList[index].CARNO + "_sec4").css('color', getLapColor(liveList[index].SEC4_FLAG));
                    }
                    if( speed == "ON" ) {
                        $("#c" + liveList[index].CARNO + "_speed").css('color', getLapColor(liveList[index].SPEED_FLAG));
                    }
                    var tireImg = "pages/images/dummy.gif";
                    if (data.TIRE != null) {
                        if( data.TIRE.length > 0 ) {
                            tireImg = "pages/images/" + data.TIRE + ".png";
                        }
                    }
                    //$("#c" + liveList[index].CARNO + "_tire").html('<img src="' + tireImg + '" width="16" border=0>');
                } else {
                    setPassingLine(data);
                }
                break;
            }
        }
    }

    function setStatusData(carno,status, pit) {

        for(var index in liveList) {
            if( liveList[index].CARNO == carno ) {
                 liveList[index].STATUS = status;
                 var pitImg = "pages/images/dummy.gif";
                 if( status == "P" ) {
                     liveList[index].PIT = pit;
                     $("#c" + carno + "_pit").text(pit);
                     pitImg = "pages/images/pit.png";
                 } else if (status == "G" ) {
                     pitImg = "pages/images/checker.png";
                 }
                 $("#c" + carno + "_status").html('<img src="' + pitImg + '" width="16" border=0>');
                break;
            }
        }
    }


    function setDriverData(data) {

        for(var index in liveList) {
            if( liveList[index].CARNO == data.CARNO ) {
                liveList[index].DRIVER_J = data.DRIVER_J;
                liveList[index].DRIVER_E = data.DRIVER_E;
                liveList[index].TEAM_J = data.TEAM_J;
                liveList[index].TEAM_E = data.TEAM_E;
                liveList[index].DRIVER_IDX = data.DRIVER_IDX;
                liveList[index].TIRE = data.TIRE;
                liveList[index].MAKER = data.MAKER;
                liveList[index].RACE_CLASS = data.RACE_CLASS;
                var c = "#c"+data.CARNO;
                var makerImg = "pages/images/dummy.gif";
                if (data.MAKER != null) {
                    if( data.MAKER.length > 0 ) {
                        makerImg = "pages/images/" + data.MAKER + ".png";
                    }
                }
                var tireImg = "pages/images/dummy.gif";
                if (data.TIRE != null) {
                    if( data.TIRE.length > 0 ) {
                        tireImg = "pages/images/" + data.TIRE + ".png";
                    }
                }
                if( lang == "EN" ) {
                    $(c + "_driver").html('<div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.8em;">' + data.TEAM_E + '</div></div></td>');
                } else {
                    $(c + "_driver").html('<div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.8em;">' + data.TEAM_J + '</div></div></td>');
                }
                //$(c + "_tire").html('<img src="' + tireImg + '" width="16" border=0>');
                $(c + "_maker").html('<img src="' + makerImg + '" width="16" border=0>');
                break;
            }
        }
    }

    function setListTitle() {

        var html = "";

        if( racemode == "B" ) {
            html = '<table class="listtable" style="table-layout: fixed;"><tr>' +
                   '<th class="pos">POS</th>' +
                   '<th class="no">No.</th>' +
                   '<th class="info"></th>' +
                   '<th class="driver">Driver/Team</th>' +
                   //'<th class="tire">T</th>' +
                   '<th class="maker">E</th>' +
                   '<th class="time">BestTime</th>' +
                   '<th class="lap">(L)</th>' +
                   '<th class="time">Gap</th>' +
                   '<th class="time">Diff</th>';
            if( sector >= 1 ) {
                html += '<th class="time">S1</th>';
            }
            if( sector >= 2 ) {
                html += '<th class="time">S2</th>';
            }
            if( sector >= 3 ) {
                html += '<th class="time">S3</th>';
            }
            if( sector >= 4 ) {
                html += '<th class="time">S4</th>';
            }
            if( speed == "ON" ) {
                html += '<th class="time">Speed</th>';
            }
            html += '<th class="time">LastLap</th>';
            html += '<th class="lap">Laps</th>' +
                    '<th class="pit">PIT</th>' +
                    '</tr></table>';
        } else {
            html = '<table class="listtable"><tr>' +
                   '<th class="pos"></th>' +
                   '<th class="pos">POS</th>' +
                   '<th class="no">No.</th>' +
                   '<th class="info"></th>' +
                   '<th class="driver">Driver/Team</th>' +
                   //'<th class="tire">T</th>' +
                   '<th class="maker">E</th>' +
                   '<th class="lap">Laps</th>' +
                   '<th class="time">Gap</th>' +
                   '<th class="time">Diff</th>';
            if( sector >= 1 ) {
                html += '<th class="time">S1</th>';
            }
            if( sector >= 2 ) {
                html += '<th class="time">S2</th>';
            }
            if( sector >= 3 ) {
                html += '<th class="time">S3</th>';
            }
            if( sector >= 4 ) {
                html += '<th class="time">S4</th>';
            }
            if( speed == "ON" ) {
                html += '<th class="time">Speed</th>';
            }
            html += '<th class="time">LastLap</th>';
            html += '<th class="time">BestTime</th>' +
                    '<th class="lap">(L)</th>' +
                    '<th class="pit">PIT</th>' +
                    '</tr></table>';
        }
        $("#listtitle").html(html);
    }

    function setRowData(data) {




        var c = "c" + data.CARNO;
        var id = "#" + c;
        var sort = 0;
        if( racemode == "B" ) {
            if( data.RUN_FLAG == "1" ) {
                sort = data.BEST_TIME * -1;
            } else {
                sort = -99999 - data.START_POS;
            }
        } else {
            if ( !isLoop ) {
              if( data.RUN_FLAG == "1" ) {
                  sort = (data.LAPS * 10000000) - data.TOTAL_TIME;
              } else {
                  sort = -99999 - data.START_POS;
              }
            } else {
                  if( data.LAPS == 0 ) {
                      sort = 1000000 + (data.PASSING_SECTOR * 100000) - data.PASSING_TOTAL;
                  } else {
                      sort = (data.LAPS * 10000000) + (data.PASSING_SECTOR * 100000) - data.PASSING_TOTAL;
                  }
            }


        }

        if( $(c).size() == 0 ) {
            if( lang == "EN" ) {
                $("#ListArea").append('<div id="c' + data.CARNO + '" class="mix category-' + data.RACE_CLASS + '"  data-sort="' + sort + '" onClick="personalClick(\'' + data.CARNO + '\',\'' + data.DRIVER_E + '\',\'' + data.TEAM_E + '\',\'' + data.RACE_CLASS + '\');"></div>');
            } else {
		var tt = data.TEAM_J.toString();
		var t = tt.replace(/'/g,"");
                $("#ListArea").append('<div id="c' + data.CARNO + '" class="mix category-' + data.RACE_CLASS + '"  data-sort="' + sort + '" onClick="personalClick(\'' + data.CARNO + '\',\'' + data.DRIVER_J + '\',\'' + t + '\',\'' + data.RACE_CLASS + '\');"></div>');
                //$("#ListArea").append('<div id="c' + data.CARNO + '" class="mix category-' + data.RACE_CLASS + '"  data-sort="' + sort + '" onClick="personalClick(\'' + data.CARNO + '\',\'' + data.DRIVER_J + '\',\'' + data.TEAM_J + '\',\'' + data.RACE_CLASS + '\');"></div>');
            }
        }

        var pitImg = "pages/images/dummy.gif";
        if( data.STATUS == "P" ) {
            pitImg = "pages/images/pit.png";
        } else if (data.STATUS == "G") {
            pitImg = "pages/images/checker.png";
        }

        var tireImg = "pages/images/dummy.gif";
        if (data.TIRE != null) {
            if( data.TIRE.length > 0 ) {
                tireImg = "pages/images/" + data.TIRE + ".png";
            }
        }

        var makerImg = "pages/images/dummy.gif";
        if (data.MAKER != null) {
            if( data.MAKER.length > 0 ) {
                makerImg = "pages/images/" + data.MAKER + ".png";
            }
        }

        var html = "";
        var t = ((sort * 1000) / 1000);


        if( racemode == "B" ) {
            html = '<table class="listtable" style="table-layout: fixed;"><tr>' +
                   '<td class="pos" id="' + c + '_pos"></td>' +
                   '<td class="no" id="' + c + '_no">' + data.CARNO + '</td>' +
                   '<td class="info" id="' + c + '_status"><img src="' + pitImg + '" width="16" border=0></td>';
            if( lang == "EN" ) {
		if (data.TEAM_E.length >= 25) {
			html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.6em;">' + data.TEAM_E + '</div></div></td>';
		} else {
                	html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.8em;">' + data.TEAM_E + '</div></div></td>';
		}
            } else {
		if (data.TEAM_J.length >= 25) {
			html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.6em;">' + data.TEAM_J + '</div></div></td>';
		} else {
                	html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.8em;">' + data.TEAM_J + '</div></div></td>';
		}
            }
            //html += '<td class="tire" id="' + c + '_tire"><img src="' + tireImg + '" width="16" border=0></td>' +
            html += '<td class="maker" id="' + c + '_maker"><img src="' + makerImg + '" width="16" border=0></td>' +
                   '<td class="time" id="' + c + '_best" style="font-weight:bold;">' + data.BEST_DISP + '</td>' +
                   '<td class="lap" id="' + c + '_bestlap">' + data.BEST_LAPS + '</td>' +
                   '<td class="time" id="' + c + '_gap"></td>' +
                   '<td class="time" id="' + c + '_diff"></td>';
            if( sector >= 1 ) {
                html += '<td class="time" id="' + c + '_sec1" style="font-weight:bold;color:' + getLapColor(data.SEC1_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC1_DISP + '</div></td>';
            }
            if( sector >= 2 ) {
                html += '<td class="time" id="' + c + '_sec2" style="font-weight:bold;color:' + getLapColor(data.SEC2_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC2_DISP + '</div></td>';
            }
            if( sector >= 3 ) {
                html += '<td class="time" id="' + c + '_sec3" style="font-weight:bold;color:' + getLapColor(data.SEC3_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC3_DISP + '</div></td>';
            }
            if( sector >= 4 ) {
                html += '<td class="time" id="' + c + '_sec4" style="font-weight:bold;color:' + getLapColor(data.SEC4_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC4_DISP + '</div></td>';
            }
            if( speed == 'ON' ) {
                html += '<td class="time" id="' + c + '_speed" style="font-weight:bold;color:' + getLapColor(data.SPEED_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + doubleToSpeed(data.SPEED) + '</div></td>';
            }
            html += '<td class="time" id="' + c + '_last" style="font-weight:bold;color:' + getLapColor(data.LAST_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.LAST_DISP + '</div></td>';
            html += '<td class="lap" id="' + c + '_laps">' + data.LAPS + '</td>' +
                    '<td class="pit" id="' + c + '_pit">' + data.PIT + '</td>' +
                    '</tr></table>';
        } else {
            html = '<table class="listtable" style="table-layout: fixed;"><tr>' +
                   '<td class="posup" id="' + c + '_posup"></td>' +
                   '<td class="pos" id="' + c + '_pos"></td>' +
                   '<td class="no" id="' + c + '_no">' + data.CARNO + '</td>' +
                   '<td class="info" id="' + c + '_status"><img src="' + pitImg + '" width="16" border=0></td>';
            if( lang == "EN" ) {
		if (data.TEAM_E.length >= 25) {
			html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.6em;">' + data.TEAM_E + '</div></div></td>';
                } else {
			html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.8em;">' + data.TEAM_E + '</div></div></td>';
		}
            } else {
		if (data.TEAM_J.length >= 25) {
			html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.6em;">' + data.TEAM_J + '</div></div></td>';
		} else {
                	html += '<td class="driver" id="' + c + '_driver"><div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.8em;">' + data.TEAM_J + '</div></div></td>';
		}
            }
            //html += '<td class="tire" id="' + c + '_tire"><img src="' + tireImg + '" width="16" border=0></td>' +
            html += '<td class="maker" id="' + c + '_maker"><img src="' + makerImg + '" width="16" border=0></td>' +
                    '<td class="lap" id="' + c + '_laps">' + data.LAPS + '</td>' +
                    '<td class="time" id="' + c + '_gap"></td>' +
                    '<td class="time" id="' + c + '_diff"></td>';
            if( sector >= 1 ) {
                html += '<td class="time" id="' + c + '_sec1" style="font-weight:bold;color:' + getLapColor(data.SEC1_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC1_DISP + '</div></td>';
            }
            if( sector >= 2 ) {
                html += '<td class="time" id="' + c + '_sec2" style="font-weight:bold;color:' + getLapColor(data.SEC2_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC2_DISP + '</div></td>';
            }
            if( sector >= 3 ) {
                html += '<td class="time" id="' + c + '_sec3" style="font-weight:bold;color:' + getLapColor(data.SEC3_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC3_DISP + '</div></td>';
            }
            if( sector >= 4 ) {
                html += '<td class="time" id="' + c + '_sec4" style="font-weight:bold;color:' + getLapColor(data.SEC4_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.SEC4_DISP + '</div></td>';
            }
            if( speed == 'ON' ) {
                html += '<td class="time" id="' + c + '_speed" style="font-weight:bold;color:' + getLapColor(data.SPEED_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + doubleToSpeed(data.SPEED) + '</div></td>';
            }
            html += '<td class="time" id="' + c + '_last" style="font-weight:bold;color:' + getLapColor(data.LAST_FLAG) + ';"><div style="width: 60px; overflow: hidden;">' + data.LAST_DISP + '</div></td>';
            html += '<td class="time" id="' + c + '_best" style="font-weight:bold;">' + data.BEST_DISP + '</td>' +
                    '<td class="lap" id="' + c + '_bestlap">' + data.BEST_LAPS + '</td>' +
                    '<td class="pit" id="' + c + '_pit">' + data.PIT + '</td>' +
                    '</tr></table>';
        }

        $(id).html(html);

    }

    function setPassingLine(data) {


        var c = "#c"+data.CARNO;

        var sort = 0;
        if( racemode == "B" ) {
            if( data.RUN_FLAG == "1" ) {
                sort = data.BEST_TIME * -1;
            } else {
                sort = -99999 - data.START_POS;
            }
        } else {
            if ( !isLoop ) {
                if( data.RUN_FLAG == "1" ) {
                    sort = (data.LAPS * 10000000) - data.TOTAL_TIME;
                } else {
                    sort = -99999 - data.START_POS;
                }
            } else {
                    if( data.LAPS == 0 ) {
                        sort = 1000000 + (data.PASSING_SECTOR * 100000) - data.PASSING_TOTAL;
                    } else {
                        sort = (data.LAPS * 10000000) + (data.PASSING_SECTOR * 100000) - data.PASSING_TOTAL;
                    }
                
             }
        }



        var pitImg = "pages/images/dummy.gif";
        if( data.STATUS == "P" ) {
            pitImg = "pages/images/pit.png";
        }  else if (data.STATUS == "G") {
            pitImg = "pages/images/checker.png";
        }

        var tireImg = "pages/images/dummy.gif";
        if (data.TIRE != null) {
            if( data.TIRE.length > 0 ) {
                tireImg = "pages/images/" + data.TIRE + ".png";
            }
        }
        var makerImg = "pages/images/dummy.gif";
        if (data.MAKER != null) {
            if( data.MAKER.length > 0 ) {
                makerImg = "pages/images/" + data.MAKER + ".png";
            }
        }

        $(c + "_status").html('<img src="' + pitImg + '" width="16" border=0>');
        if( lang == "EN" ) {
	    if (data.TEAM_E.length >= 25) {
		$(c + "_driver").html('<div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.6em;">' + data.TEAM_E + '</div></div></td>');
	    } else {
                $(c + "_driver").html('<div style="width: 170px; overflow: hidden;">' + data.DRIVER_E + '<br><div style="font-size:0.8em;">' + data.TEAM_E + '</div></div></td>');
	    }
        } else {
            if (data.TEAM_J.length >= 25) {
                $(c + "_driver").html('<div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.6em;">' + data.TEAM_J + '</div></div></td>');
	    } else {
                $(c + "_driver").html('<div style="width: 170px; overflow: hidden;">' + data.DRIVER_J + '<br><div style="font-size:0.8em;">' + data.TEAM_J + '</div></div></td>');
            }
        }
        //$(c + "_tire").html('<img src="' + tireImg + '" width="16" border=0>');
        $(c + "_maker").html('<img src="' + makerImg + '" width="16" border=0>');
        $(c + "_best").text(data.BEST_DISP);
        $(c + "_bestlap").text(data.BEST_LAPS);
        if( sector >= 1 ) {
            $(c + "_sec1").text(data.SEC1_DISP);
            $(c + "_sec1").css('color', getLapColor(data.SEC1_FLAG));
        }
        if( sector >= 2 ) {
            $(c + "_sec2").text(data.SEC2_DISP);
            $(c + "_sec2").css('color', getLapColor(data.SEC2_FLAG));
        }
        if( sector >= 3 ) {
            $(c + "_sec3").text(data.SEC3_DISP);
            $(c + "_sec3").css('color', getLapColor(data.SEC3_FLAG));
        }
        if( sector >= 4 ) {
            $(c + "_sec4").text(data.SEC4_DISP);
            $(c + "_sec4").css('color', getLapColor(data.SEC4_FLAG));
        }
        if( speed == 'ON' ) {
            $(c + "_speed").text(doubleToSpeed(data.SPEED));
            $(c + "_speed").css('color', getLapColor(data.SPEED_FLAG));
        }
        $(c + "_last").text(data.LAST_DISP);
        $(c + "_laps").text(data.LAPS);
        $(c + "_pit").text(data.PIT);
        $(c + "_last").css('color', getLapColor(data.LAST_FLAG));

        var sec = "";
        if( data.type == "L" ) {
            sec = "s4";
        } else if( data.type == "1" ) {
            sec = "s1";
        } else if( data.type == "2" ) {
            sec = "s2";
        } else if( data.type == "3" ) {
            sec = "s3";
        }

        if( sec.length > 0 ) {
            $(c).css('animation', sec + " 1s 1");
            $(c).css('-webkit-animation', sec + " 1s 1");
            $(c).on('webkitAnimationEnd', function(){
                $(c).css('-webkit-animation', "none");
//            $(c).css('-webkit-animation-play-state', "paused");
                $(c).css('background-color', "#111");
            });

            $(c).on('animationend', function(){
                $(c).css('animation', sec + " 0s 0");
//            $(c).css('animation-play-state', "paused");
                $(c).css('background-color', "#111");
            });
        }

        $(c).attr("data-sort",sort);

    }

    function getLapColor(colorCode) {
        var res = "#fff";
        if( colorCode == "1" ) {
            res = "#0f0";
        } else if( colorCode == "2" ) {
            res = "#F0F";
        }
        return res;
    }

    $(function(){
        $('#Container').mixItUp({
            callbacks: {
                onMixLoad: function() {
            },
                onMixStart: function() {
            },
                onMixEnd: function() {
    	            var list = $("#ListArea").children('div');
                    var toplap = 0;
                    var beforelap = 0;
                    var toptime = 0;
                    var beforetime = 0;
                    var gap = "";
                    var diff = "";
                    var pos = 1;
      
                    //LoopMode
                    var topsector = 0;
                    var topsec1 = 0;
                    var topsec2 = 0;
                    var topsec3 = 0;
                    var toplaptime = 0;
                    var beforetimesec1 = 0;
                    var beforetimesec2 = 0;
                    var beforetimesec3 = 0;
                    var beforetimefl = 0;

                    var beforetopsec1 = 0;
                    var beforetopsec2 = 0;
                    var beforetopsec3 = 0;
                    var beforetoplaptime = 0;
                    var beforesector = 0;
  





                    for(var i=0; i < list.length; i++) {
                        var id = list.eq(i).attr('id');
                        var data = getLineData(id.substr(1));
                        if( data == null ) {
                            continue;
                        }
                        var rclass = list.eq(i).attr('class').substr(13);
                        if( dispclass != "all" ) {
                            if( dispclass != rclass ) {
                                continue;
                            }
                        }
                        var laps = 0;
                        if( data.LAPS.length > 0 ) {
                            laps = parseInt(data.LAPS, 10);
                        }
                        if( pos == 1 ) {
                            gap = "-";
                            diff = "-";
                            if( racemode == "B" ) {
                                toptime = data.BEST_TIME;
                                beforetime = data.BEST_TIME;
                            } else {
                                toplap = laps;
                                
                                if ( !isLoop ) {  //NormalMode
                                    toptime = data.TOTAL_TIME;
                                    beforetime = data.TOTAL_TIME;
                                } else {  //LoopMode
                                    toptime = data.PASSING_TOTAL;
                                    beforetime = data.PASSING_TOTAL;
                                    topsector = data.PASSING_SECTOR;                                
				    topsec1 = data.SEC1_SEQ;
                                    topsec2 = data.SEC2_SEQ;                        
                                    topsec3 = data.SEC3_SEQ;
                                    toplaptime = data.TOTAL_TIME; 
                                    beforetimesec1 = data.SEC1_SEQ;
                                    beforetimesec2 = data.SEC2_SEQ;
                                    beforetimesec3 = data.SEC3_SEQ;
                                    beforetimefl = data.TOTAL_TIME;
                                  }
                                

                                beforetopsec1 = topsec1;
                                beforetopsec2 = topsec2;
                                beforetopsec3 = topsec3;
                                beforetoplaptime = toplaptime;

				beforelap = laps;
                        

                            }
                        } else {
                            if( racemode == "B" ) {
                                if( data.BEST_TIME == 9999999999 ) {
                                    gap = "";
                                    diff = "";
                                } else {
                                    gap = (data.BEST_TIME - toptime).toFixed(3);
				    if( gap >= 60 ) {
				        gap = doubleToTime(gap);
				    }
                                    diff = (data.BEST_TIME - beforetime).toFixed(3);
				    if( diff >= 60 ) {
				        diff = doubleToTime(diff);
				    }
                                }
                                beforetime = data.BEST_TIME;
				if (pos == 6) {
			          console.log(data);		
				}
                            } else {
                                
                                //Gap
                                if( toplap > data.LAPS ) {
                                        if ( !isLoop ) {  //NormalMode
                                            gap = (toplap - laps).toString() + " LAP";
                                        } else {  //LoopMode

                                           if ( data.PASSING_SECTOR == "1" ) {
                                               if ((toplap - laps) > 1 ){
                                                   gap = (toplap - laps).toString() + " LAP";
 