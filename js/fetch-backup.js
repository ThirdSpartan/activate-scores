import { PlaywrightCrawler, Dataset } from 'crawlee';

async function getAndSaveScores() {
    const room_crawler = new PlaywrightCrawler({
        async requestHandler({ request, page, log }) {
            log.info(request.url);
            const accordionHandle = page.locator('#games-accordion');
            await accordionHandle.click();
            const game_links_obj = await page.evaluate(() =>  {
                const games_accordion = document.getElementById('games-accordion');
                const game_links = games_accordion.getElementsByTagName('a');
                const game_links_array = Array.from(game_links);
                const game_links_obj = game_links_array.reduce((map, link) => (map[link.href.toLowerCase()] = link.innerText, map), {});
                return game_links_obj;
            });
            game_urls_obj = game_links_obj;
        },
        // headless: false,
    });

    const game_crawler = new PlaywrightCrawler({
        async requestHandler({page}) {
            const games =  await page.evaluate(() =>  {
                const select = document.getElementsByName('game')[0];
                const options_array = Array.from(select.options);
                const games = options_array.map((option) => {return option.innerHTML});
                return games;
            });

            const page_url = page.url()
            let total_scores = {};
            const room_name = game_urls_obj[page_url];
            const is_highscore = page_url.toLowerCase().includes('highscore');

            for (const game of games) {
                const selectHandle = await page.evaluateHandle(() => document.getElementsByName('game')[0]);
                const gameString = game.toString();
                await selectHandle.selectOption(gameString);
                const game_scores =  await page.evaluate((is_highscore) =>  {
                    const table = document.getElementsByTagName('table')[0];
                    var scores = {};
                    for (var r = 2, n = table.rows.length; r < n; r++) {
                        let level_num = table.rows[r].cells[0].innerHTML;
                        let level_score = 0;
                        if (is_highscore) {
                            level_score = table.rows[r].cells[2].innerHTML.trim();
                            level_score = level_score === '-'? 'No Score': level_score;
                        } else {
                            level_score = table.rows[r].cells[1].innerHTML.trim();
                        }

                        scores[level_num] = level_score;
                    }
                    return scores;
                }, is_highscore);
                total_scores[gameString] = game_scores;
            } 
            player_scores[current_player][room_name] = total_scores
        },
        // headless: false,
    });

    var player_scores = {};
    var current_player;
    var game_urls_obj;
    for (const player of player_list) {
        current_player = player;
        player_scores[player] = {};
        const score_url = [`https://playactivate.com/scores/${player}/23/Cincinnati%20%28Oakley%29/scores`];
        await room_crawler.run(score_url);
        let game_urls = Object.keys(game_urls_obj);
        await game_crawler.run(game_urls);
    }
    const playerScoreDataSet = await Dataset.open('player-scores');
    await playerScoreDataSet.pushData(player_scores);
}

async function convertScores() {
    const playerScoreDataSet = await Dataset.open('player-scores');
    const playerScoreDataSetContent = await playerScoreDataSet.getData();
    let data = playerScoreDataSetContent.items[0];
    let new_data = {
        name: "Scores",
        children: []
    }
    
    Object.keys(data).sort().forEach(player => {
    //for (const player in data){
        let player_obj = {
            name: player,
            children: []
        }
        Object.keys(data[player]).sort().forEach(room => {
        //for (const room in data[player]){
            let room_obj = {
                name: room,
                children: []
            }
            Object.keys(data[player][room]).sort().forEach(game => {
            // for (const game in data[player][room]) {
                let game_obj = {
                    name: game,
                    children: []
                }
                // Object.keys(data[player][room][game]).sort().forEach(level => {
                for (const level in data[player][room][game]) {
                    let level_obj = {
                        name: `${level}: ${data[player][room][game][level]}`,
                        // value: data[player][room][game][level] != 'No Score' ? Number(data[player][room][game][level]) : 100
                        value: 100,
                        highscore:  data[player][room][game][level] === 'No Score' ? false : data['HIGHSCORE'][room][game][level] === data[player][room][game][level] ? true : false
                    }
                    game_obj.children.push(level_obj);
                }
                room_obj.children.push(game_obj);
            })
            player_obj.children.push(room_obj);
        })
        new_data.children.push(player_obj);
    })
    const formattedScoreDataSet = await Dataset.open('formatted-scores');
    await formattedScoreDataSet.pushData(new_data);
}

async function groupGetSpecificScores() {
    // let data = JSON.parse(await readFile("activate_scores.json", "utf8"));

    const specific_games = {
        GRID: {Strategy: 2},
        CONTROL: {Bop: 6},
        HIDE: {Numbers: 3},
        HOOPS: {"15 Green": 2},
        LASER: {"Laser Relay": 3},
        "MEGA GRID": {"Order Up": 4},
        PRESS: {"Bullet Train": 2},
        STRIKE: {Terminal: 3}
    }

    let grouped_scores = {}

    let longest_len = player_list.reduce(function(a, b) { 
        return a.length > b.length ? a : b
      }, '').length;

    console.log(longest_len);
    for (const room in specific_games) {
        for (const game in specific_games[room]) {
            for(let player of player_list) {
                let level = specific_games[room][game];
                let formatted_player = player.padStart(longest_len - player.length, "_");
                console.log(longest_len - player.length);
                let score_key = `${formatted_player}: ${room}: ${game}: ${level}`;
                let score = data[player][room][game][level];
                // console.log(`${score_key}, ${score}`);
                grouped_scores[score_key] = score
            }
        }
    }

    console.log(grouped_scores);
    await Dataset.pushData(grouped_scores);
}

