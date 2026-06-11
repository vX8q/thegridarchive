package schedulefile

import (
	"database/sql"
	"fmt"
	"log"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
)

// BuildDriverStatsFromDB loads aggregated metrics from SQL view driver_stats_stockcar (stock-car)
// or from results aggregation for F1/F2/F3 (openwheel). On 0 rows — JSON fallback.
func BuildDriverStatsFromDB(db *sql.DB, dataDir string, seriesID string, season string) (*DriverStatsData, error) {
	if db == nil {
		return buildDriverStatsFromJSON(dataDir, seriesID, season)
	}
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}

	// F1, F2, F3: stats from results (starts, wins, top-2, top-3, podiums, top-5, top-10, fastest laps, avg.start, avg.finish, laps led, laps completed)
	if strings.EqualFold(seriesID, "F1") || strings.EqualFold(seriesID, "F2") || strings.EqualFold(seriesID, "F3") {
		data, err := buildDriverStatsFromDBOpenwheel(db, seriesID, season)
		if err != nil {
			return nil, err
		}
		if data != nil && len(data.Rows) > 0 {
			var f1Qual map[string]q2q3Count
			// F1: fill chassis and refine qualifying stats from event JSON.
			if strings.EqualFold(seriesID, "F1") {
				if teamsData, loadErr := LoadTeams(dataDir, "f1"); loadErr == nil && teamsData != nil && len(teamsData.Teams) > 0 {
					chassisByDriverCar := make(map[string]string)
					manufacturerByDriverCar := make(map[string]string)
					manufacturerByDriver := make(map[string]string)
					manufacturerByCar := make(map[string]string)
					for _, t := range teamsData.Teams {
						driverKey := strings.TrimSpace(strings.ToLower(t.Driver))
						number := strings.TrimSpace(t.Number)
						if driverKey == "" && number == "" {
							continue
						}
						key := driverKey + "|" + number
						if strings.TrimSpace(t.Chassis) != "" && key != "|" {
							chassisByDriverCar[key] = strings.TrimSpace(t.Chassis)
						}
						if strings.TrimSpace(t.Manufacturer) != "" {
							man := strings.TrimSpace(t.Manufacturer)
							if key != "|" {
								manufacturerByDriverCar[key] = man
							}
							if driverKey != "" {
								manufacturerByDriver[driverKey] = man
							}
							if number != "" {
								manufacturerByCar[number] = man
							}
						}
					}
					for i := range data.Rows {
						driverKey := strings.TrimSpace(strings.ToLower(data.Rows[i].Driver))
						carNum := strings.TrimSpace(data.Rows[i].Car)
						key := driverKey + "|" + carNum
						if ch := chassisByDriverCar[key]; ch != "" {
							data.Rows[i].Chassis = ch
						}
						if data.Rows[i].Manufacturer == "" {
							if man := manufacturerByDriverCar[key]; man != "" {
								data.Rows[i].Manufacturer = man
							} else if man := manufacturerByCar[carNum]; man != "" {
								data.Rows[i].Manufacturer = man
							} else if man := manufacturerByDriver[driverKey]; man != "" {
								data.Rows[i].Manufacturer = man
							}
						}
					}
				}
				// Q2/Q3 passes and avg_qualifying (and poles) from qualifying tables in event JSON.
				if q2q3, err := loadF1QualifyingQ2Q3Passes(dataDir, season); err == nil && len(q2q3) > 0 {
					f1Qual = q2q3
					for i := range data.Rows {
						key := strings.TrimSpace(strings.ToLower(data.Rows[i].Driver))
						if v, ok := q2q3[key]; ok {
							data.Rows[i].Q2Passes = v.Q2
							data.Rows[i].Q3Passes = v.Q3
							// F1: avg_qualifying from qualifying table (Pos),
							// not from grid_position in results.
							if v.Count > 0 {
								data.Rows[i].AvgQualifying = v.SumPos / float64(v.Count)
							}
						}
					}
				}
			}
			// Formula series: merge duplicate rows for one driver
			// (different team/chassis mid-season — one row per driver).
			data.Rows = mergeOpenWheelDriverStatsRows(data.Rows)
			// After mergeOpenWheelDriverStatsRows do not sum poles across duplicates,
			// so set poles in a separate pass.
			if strings.EqualFold(seriesID, "F1") && f1Qual != nil && len(f1Qual) > 0 {
				for i := range data.Rows {
					key := strings.TrimSpace(strings.ToLower(data.Rows[i].Driver))
					if v, ok := f1Qual[key]; ok {
						data.Rows[i].Poles = v.Poles
					}
				}
			}

			teams := aggregateByTeam(data.Rows)
			mans := aggregateByManufacturer(data.Rows)
			return &DriverStatsData{Rows: data.Rows, Teams: teams, Manufacturers: mans}, nil
		}
		log.Printf("stats: openwheel DB returned 0 rows for %s season %s, trying JSON fallback", seriesID, season)
		return buildDriverStatsFromJSON(dataDir, seriesID, season)
	}

	rows, err := db.Query(`
SELECT
  driver_name,
  team_name,
  manufacturer,
  car_number,
  races,
  wins,
  poles,
  top5,
  top10,
  top15,
  top20,
  avg_finish,
  avg_start,
  stage_wins,
  stage_points,
  avg_stage_points,
  laps_led,
  laps_completed_pct,
  pos_diff
FROM driver_stats_stockcar
WHERE UPPER(series_id) = UPPER(?) AND season = ?
ORDER BY wins DESC, top5 DESC, top10 DESC, driver_name
`, seriesID, season)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var out []DriverStatsRow
	for rows.Next() {
		var r DriverStatsRow
		var avgFinish, avgStart, avgStagePts, lapsPct, posDiff sql.NullFloat64
		if err := rows.Scan(
			&r.Driver,
			&r.Team,
			&r.Manufacturer,
			&r.Car,
			&r.Races,
			&r.Wins,
			&r.Poles,
			&r.Top5,
			&r.Top10,
			&r.Top15,
			&r.Top20,
			&avgFinish,
			&avgStart,
			&r.StageWins,
			&r.StagePoints,
			&avgStagePts,
			&r.LapsLed,
			&lapsPct,
			&posDiff,
		); err != nil {
			return nil, err
		}
		r.AvgFinish = nullFloat64(avgFinish)
		r.AvgStart = nullFloat64(avgStart)
		r.AvgStagePoints = nullFloat64(avgStagePts)
		r.LapsCompletedPct = nullFloat64(lapsPct)
		r.PositionDiff = nullFloat64(posDiff)
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if out == nil {
		out = []DriverStatsRow{}
	}

	// Supercars: merge rows with numbers 800 and 8 into one (canonical number 8).
	if strings.EqualFold(seriesID, "SUPERCARS") && len(out) > 0 {
		out = MergeSupercarsDriverStatsRows(out)
	}

	// Supercars: team and manufacturer names from /series/supercars/teams (data/teams/supercars.json).
	if strings.EqualFold(seriesID, "SUPERCARS") && len(out) > 0 {
		teamByCar := make(map[string]string)
		manufacturerByCar := make(map[string]string)
		if teams, err := LoadTeams(dataDir, "SUPERCARS"); err == nil && teams != nil {
			for _, t := range teams.Teams {
				rawNum := strings.TrimSpace(t.Number)
				if rawNum == "" {
					continue
				}
				team := strings.TrimSpace(t.Team)
				manufacturer := strings.TrimSpace(t.Manufacturer)
				canonical := SupercarsCarToCanonical(rawNum)
				if canonical != "" {
					if team != "" {
						teamByCar[canonical] = team
					}
					if manufacturer != "" {
						manufacturerByCar[canonical] = manufacturer
					}
				}
				numVariants := map[string]struct{}{rawNum: {}, canonical: {}}
				if n, err := strconv.Atoi(strings.TrimLeft(rawNum, "0")); err == nil {
					numInt := strconv.Itoa(n)
					numVariants[numInt] = struct{}{}
					if n >= 1 && n <= 9 {
						numVariants[fmt.Sprintf("%02d", n)] = struct{}{}
					}
				}
				for num := range numVariants {
					if team != "" {
						teamByCar[num] = team
					}
					if manufacturer != "" {
						manufacturerByCar[num] = manufacturer
					}
				}
			}
		}
		for i := range out {
			car := strings.TrimSpace(out[i].Car)
			if car == "" {
				continue
			}
			if name := teamByCar[car]; name != "" {
				out[i].Team = name
			}
			if name := manufacturerByCar[car]; name != "" {
				out[i].Manufacturer = name
			}
		}
	}

	// Fallback: if DB has no data for series/season — build from JSON.
	if len(out) == 0 {
		log.Printf("stats: DB returned 0 rows for %s season %s, trying JSON fallback (dataDir=%s)", seriesID, season, filepath.Join(dataDir, "events"))
		return buildDriverStatsFromJSON(dataDir, seriesID, season)
	}

	// Stock-car (NASCAR Cup/Truck/Modified, ARCA, NOAPS): also collapse
	// possible duplicates of the same driver with different driver_id in the view.
	switch strings.ToUpper(seriesID) {
	case "NASCAR_CUP", "NASCAR_TRUCK", "NASCAR_MODIFIED", "ARCA", "NOAPS":
		out = mergeStockCarDriverStatsRows(out)
	}

	mans := aggregateByManufacturer(out)
	teams := aggregateByTeam(out)

	// Supercars: if Manufacturer Stats empty (view uses teams.car manufacturer, empty for Supercars),
	// fill manufacturer from teams file by car number and rebuild manufacturers.
	if strings.EqualFold(seriesID, "SUPERCARS") && len(mans) == 0 && len(out) > 0 {
		if teamsData, err := LoadTeams(dataDir, "SUPERCARS"); err == nil && teamsData != nil {
			manufacturerByCar := make(map[string]string)
			for _, t := range teamsData.Teams {
				rawNum := strings.TrimSpace(t.Number)
				if rawNum == "" {
					continue
				}
				manufacturer := strings.TrimSpace(t.Manufacturer)
				if manufacturer == "" {
					continue
				}
				canonical := SupercarsCarToCanonical(rawNum)
				if canonical != "" {
					manufacturerByCar[canonical] = manufacturer
				}
				manufacturerByCar[rawNum] = manufacturer
				if n, err := strconv.Atoi(strings.TrimLeft(rawNum, "0")); err == nil {
					manufacturerByCar[strconv.Itoa(n)] = manufacturer
					if n >= 1 && n <= 9 {
						manufacturerByCar[fmt.Sprintf("%02d", n)] = manufacturer
					}
				}
			}
			for i := range out {
				car := strings.TrimSpace(out[i].Car)
				if car == "" {
					continue
				}
				if name := manufacturerByCar[car]; name != "" {
					out[i].Manufacturer = name
				}
			}
			mans = aggregateByManufacturer(out)
		}
	}

		return &DriverStatsData{Rows: out, Teams: teams, Manufacturers: mans}, nil
	}

// lapTimeToSeconds converts fastest_lap (M:SS.mmm or SS.mmm) to seconds for comparison.
const lapTimeToSecondsExpr = `CASE
  WHEN TRIM(COALESCE(r.fastest_lap, '')) = '' THEN 1e9
  WHEN INSTR(TRIM(r.fastest_lap), ':') = 0 THEN CAST(TRIM(r.fastest_lap) AS REAL)
  ELSE CAST(SUBSTR(TRIM(r.fastest_lap), 1, INSTR(TRIM(r.fastest_lap), ':') - 1) AS REAL) * 60
       + CAST(SUBSTR(TRIM(r.fastest_lap), INSTR(TRIM(r.fastest_lap), ':') + 1) AS REAL) END`

// buildDriverStatsFromDBOpenwheel aggregates F1/F2/F3 stats from results: starts, wins, top-2, top-3, top-5, top-10, fastest laps (best lap per race only), avg.start, avg.finish, laps led, laps completed.
func buildDriverStatsFromDBOpenwheel(db *sql.DB, seriesID string, season string) (*DriverStatsData, error) {
	//nolint:gosec // Query text is composed only of '?' placeholders, values are still parameterized.
	query := `
WITH race_fastest_sec AS (
  SELECT r2.race_id, MIN(` + strings.ReplaceAll(lapTimeToSecondsExpr, "r.fastest_lap", "r2.fastest_lap") + `) AS min_sec
  FROM results r2
  JOIN races ra ON r2.race_id = ra.id
  JOIN events e ON ra.event_id = e.id
  WHERE UPPER(e.series_id) = UPPER(?) AND e.season = ? AND TRIM(COALESCE(r2.fastest_lap, '')) <> ''
    -- F1/F2/F3: exclude sprint races (race ID/name contains "SPRINT")
    AND UPPER(ra.id) NOT LIKE '%SPRINT%'
    AND UPPER(COALESCE(ra.name, '')) NOT LIKE '%SPRINT%'
  GROUP BY r2.race_id
),
base AS (
  SELECT
    r.driver_id,
    COALESCE(d.name, '') AS driver_name,
    COALESCE(t.name, '') AS team_name,
    COALESCE(t.car, '') AS manufacturer,
    COALESCE(r.car_number, '') AS car_number,
    r.position,
    r.grid_position,
    UPPER(TRIM(COALESCE(r.status, ''))) AS status,
    COALESCE(r.laps, 0) AS laps,
    COALESCE(r.laps_led, 0) AS laps_led,
    CASE WHEN TRIM(COALESCE(r.fastest_lap, '')) = '' THEN 0
         WHEN rf.min_sec IS NOT NULL AND (` + lapTimeToSecondsExpr + `) = rf.min_sec THEN 1
         ELSE 0 END AS has_fastest_lap,
    TRIM(COALESCE(r.fastest_lap, '')) AS fastest_lap_raw
  FROM results r
  JOIN races ra ON r.race_id = ra.id
  JOIN events e ON ra.event_id = e.id
  LEFT JOIN race_fastest_sec rf ON r.race_id = rf.race_id
  LEFT JOIN drivers d ON r.driver_id = d.id
  LEFT JOIN teams t ON r.team_id = t.id
  WHERE UPPER(e.series_id) = UPPER(?) AND e.season = ?
    -- F1/F2/F3: exclude sprint races so avg_start/avg_finish/avg_qualifying
    -- use feature races only; sprints are separate columns.
    AND UPPER(ra.id) NOT LIKE '%SPRINT%'
    AND UPPER(COALESCE(ra.name, '')) NOT LIKE '%SPRINT%'
)
SELECT
  driver_id,
  driver_name,
  team_name,
  manufacturer,
  car_number,
  -- Starts: drivers who actually took the start (at least 1 lap).
  SUM(CASE WHEN laps > 0 THEN 1 ELSE 0 END) AS races,
  SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN position = 2 THEN 1 ELSE 0 END) AS top2,
  SUM(CASE WHEN position = 3 THEN 1 ELSE 0 END) AS top3,
  SUM(CASE WHEN position >= 1 AND position <= 5 THEN 1 ELSE 0 END) AS top5,
  SUM(CASE WHEN position >= 1 AND position <= 10 THEN 1 ELSE 0 END) AS top10,
  SUM(has_fastest_lap) AS fastest_laps,
  MIN(CASE WHEN TRIM(fastest_lap_raw) <> '' THEN fastest_lap_raw ELSE NULL END) AS best_lap,
  AVG(CASE WHEN status <> 'DNS' AND grid_position > 0 THEN grid_position * 1.0 END) AS avg_start,
  AVG(CASE WHEN grid_position > 0 THEN grid_position * 1.0 END) AS avg_qualifying,
  AVG(CASE WHEN position > 0 AND status NOT IN ('DNS', 'DNF', 'RET', 'NC') THEN position * 1.0 END) AS avg_finish,
  -- Poles: P1 in qualifying (grid_position=1 for feature races).
  SUM(CASE WHEN grid_position = 1 THEN 1 ELSE 0 END) AS poles,
  SUM(laps_led) AS laps_led,
  SUM(laps) AS laps_completed
FROM base
GROUP BY driver_id, driver_name, team_name, manufacturer, car_number
ORDER BY wins DESC, top3 DESC, top5 DESC, top10 DESC, driver_name
`
	rows, err := db.Query(query, seriesID, season, seriesID, season)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var out []DriverStatsRow
	for rows.Next() {
		var r DriverStatsRow
		var avgFinish, avgStart, avgQualifying sql.NullFloat64
		var discard string
  if err := rows.Scan(
			&discard, // driver_id
			&r.Driver,
			&r.Team,
			&r.Manufacturer,
			&r.Car,
			&r.Races,
			&r.Wins,
			&r.Top2,
			&r.Top3,
			&r.Top5,
			&r.Top10,
			&r.FastestLaps,
			&r.BestLap,
			&avgStart,
			&avgQualifying,
			&avgFinish,
			&r.Poles,
			&r.LapsLed,
			&r.LapsCompleted,
		); err != nil {
			return nil, err
		}
		r.AvgStart = nullFloat64(avgStart)
		r.AvgQualifying = nullFloat64(avgQualifying)
		r.AvgFinish = nullFloat64(avgFinish)
		r.Podiums = r.Wins + r.Top2 + r.Top3
		if r.AvgStart > 0 && r.AvgFinish > 0 {
			r.PositionDiff = r.AvgStart - r.AvgFinish
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, nil
	}
	return &DriverStatsData{Rows: out}, nil
}

type q2q3Count struct {
	Q2, Q3 int
	// avg_qualifying: total qualifying position and appearance count.
	SumPos float64
	Count  int
	// poles: how many times qualifying position was 1.
	Poles int
}

// loadF1QualifyingQ2Q3Passes reads F1 event JSON for season and counts Q2/Q3 passes per driver.
func loadF1QualifyingQ2Q3Passes(dataDir, season string) (map[string]q2q3Count, error) {
	out := make(map[string]q2q3Count)

	// Previously scanned files directly in data/events, but F1 2025
	// JSON lives in "F1 2025" subfolder; LoadEventDetail already
	// resolves the path correctly. Safer to iterate the event list.
	events, err := LoadEvents(dataDir, "F1")
	if err != nil {
		return nil, err
	}
	for _, ev := range events {
		if season != "" && strings.TrimSpace(ev.Season) != strings.TrimSpace(season) {
			continue
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		qual, ok := detail.Tables["qualifying"]
		if !ok {
			continue
		}

		// Event JSON qualifying often has tables.qualifying.sessions[].
		// Need standard "Qualifying classification" (has Q2/Q3).
		var headers []string
		var rows [][]string
		if len(qual.Headers) > 0 && len(qual.Rows) > 0 {
			headers = qual.Headers
			rows = qual.Rows
		} else if len(qual.Sessions) > 0 {
			for _, sess := range qual.Sessions {
				cDriver := firstColIndex(sess.Headers, "Driver")
				cQ2 := firstColIndex(sess.Headers, "Q2")
				cQ3 := firstColIndex(sess.Headers, "Q3")
				cPos := firstColIndex(sess.Headers, "Pos", "Pos.", "P")
				if cDriver >= 0 && cQ2 >= 0 && cQ3 >= 0 && cPos >= 0 && len(sess.Rows) > 0 {
					headers = sess.Headers
					rows = sess.Rows
					break
				}
			}
		}
		if len(headers) == 0 || len(rows) == 0 {
			continue
		}

		colDriver := firstColIndex(headers, "Driver")
		colQ2 := firstColIndex(headers, "Q2")
		colQ3 := firstColIndex(headers, "Q3")
		colPos := firstColIndex(headers, "Pos", "Pos.", "P")
		if colDriver < 0 || colQ2 < 0 || colQ3 < 0 || colPos < 0 {
			continue
		}

		for _, row := range rows {
			driver := valueAt(row, colDriver)
			if driver == "" {
				continue
			}
			key := strings.TrimSpace(strings.ToLower(driver))
			v := out[key]
			q2Val := strings.TrimSpace(strings.ToUpper(valueAt(row, colQ2)))
			q3Val := strings.TrimSpace(strings.ToUpper(valueAt(row, colQ3)))
			if q2Val != "" && q2Val != "N/A" {
				v.Q2++
			}
			if q3Val != "" && q3Val != "N/A" && q3Val != "NO TIME" {
				v.Q3++
			}
			// avg_qualifying: use Pos column when numeric.
			if p := atoiSafe(valueAt(row, colPos)); p > 0 {
				v.SumPos += float64(p)
				v.Count++
				if p == 1 {
					v.Poles++
				}
			}
			out[key] = v
		}
	}
	return out, nil
}

