

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();

app.get('/location', async (req, res) => {
    const pageUrl = req.query.pageUrl;
    if (!pageUrl) {
        return res.status(400).send({ error: 'Missing pageUrl query parameter' });
    }

    try {
        const response = await axios.get(pageUrl);
        const $ = cheerio.load(response.data);
        const script = $('#flex').html(); // Get the script from the div with id "flex"
        let embedUrl = '';

        const jsonContent = JSON.parse(script);
        console.log(jsonContent);
        if (jsonContent['@type'] === 'VideoObject') {
            embedUrl = jsonContent.embedUrl;
        }

        const locationUrl = await getLocationFromEmbed(embedUrl);
        return res.send({ locationUrl });
    } catch (error) {
        console.error(`Failed to get location from embed: ${error}`);
        return res.status(500).send({ error: 'Failed to get location from embed' });
    }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port ${PORT}`));

async function getLocationFromEmbed(embed) {
    const intermediaries = [];
    let real = '';

    async function getIntermediary() {
        const body = await httpRequestBody(embed, embed);
        if (!body) return false;
    
        const $ = cheerio.load(body);
        const scripts = [];
    
        $('script').each((_, script) => {
            if ($(script).html().includes('player.src')) {
                scripts.push($(script).html());
            }
        });
    
        if (scripts.length < 1) {
            console.log('No scripts found');
            return false;
        }
    
        const script = scripts[0];
        const mp4Match = script.match(/player\.src\(\[{src:\s*["']([^"']+)["']/);
    
        if (!mp4Match) {
            console.log('No mp4Match found');
            return false;
        }
    
        intermediaries.push(`https://video.sibnet.ru${mp4Match[1]}`);
        return true;
    }

async function followRedirection() {
    if (intermediaries.length === 0) {
        console.log('No intermediaries found');
        return false;
    }

    const res = await httpRequest(intermediaries[0], embed);

    if (res && res.status === 302) {
        intermediaries.push(correct(res.headers.location));
        const secondRes = await httpRequest(intermediaries[1]);

        if (secondRes) {
            switch (secondRes.status) {
                case 302:
                    real = correct(secondRes.headers.location);
                    break;
                case 200:
                    real = intermediaries.pop();
                    break;
                default:
                    console.log('Second response status is not 302 or 200');
                    return false;
            }
        } else {
            console.log('Second request failed');
            return false;
        }
    } else {
        console.log('First request failed');
        return false;
    }

    return true;
}

    function getLocation() {
        return real;
    }

    function correct(url) {
        return url.startsWith('https:') ? url : `https:${url}`;
    }

    async function httpRequestBody(url, referer) {
        const headers = getHeaders(referer);
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            console.error(`Failed to fetch from ${url}: ${error}`);
            return null;
        }
    }
    
    async function httpRequest(url, referer) {
        const headers = getHeaders(referer);
        try {
            const response = await axios.get(url, { headers, maxRedirects: 0, validateStatus: function (status) { return status >= 200 && status < 303; } });
            return response;
        } catch (error) {
            console.error(`Failed to fetch from ${url}: ${error}`);
            return null;
        }
    }
    
    function getHeaders(referer) {
        return {
            'Accept': '*/*',
            'Accept-Encoding': 'identity;q=1, *;q=0',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Cookie': '__counter_session_visitor_type_2169=new; __sibc_vuid=j47Lq17Gq6ZD3HItYjO_1706049823; __counter_sibnet_pr_url=https%3A%2F%2Fvideo.sibnet.ru%2Fshell.php%3Fvideoid%3D5410090; __counter_seslk_2169=1; visitor_session=MpF7gARRvl5ExLxOfdPXtMv9xBB4El; sib_userid=8250850ff253a40c9b8dff3b9eade1b8; advast_user=cf9c94ff85482ca16f4ffa4e59064a87; _ym_uid=1706049724901383892; _ym_d=1706049724; _ga=GA1.2.1268924244.1706049725; _gid=GA1.2.1560357250.1706049725; __counter_last_visit_2169=1706049814954; __counter_sibnet_pr_cudid=ZCFcJOTNak0Cs0Ty0BflwyS4n2DLGmCb_1706049814953',
            'Host': 'video.sibnet.ru',
            'Range': 'bytes=0-',
            'Referer': referer,
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': 'Windows'
        };
    }

    await getIntermediary();
    await followRedirection();
    return getLocation();
}