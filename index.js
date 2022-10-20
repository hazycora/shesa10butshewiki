const wikity = require('wikity')
const html2md = require('html-to-md')
// const html2md = require('html2md')
const sanitizeHtml = require('sanitize-html')

const API_QUERY = {
    action: 'query',
    format: 'json',
    prop: 'categories|revisions',
    list: '',
    meta: '',
    generator: 'random',
    formatversion: 'latest',
    rvprop: 'content',
    grnnamespace: '0',
    grnlimit: '20'
}
const getWikiApiUrl = (() => {
    const BASE_URL = `https://en.wikipedia.org/w/api.php`
    return (options) => {
        let baseUrl = new URL(BASE_URL)
        for (let key of Object.keys(options)) {
            baseUrl.searchParams.set(key, options[key])
        }
        return baseUrl.href
    }
})()
const API_URL = getWikiApiUrl(API_QUERY)

function wikitextToMd(text) {
    // remove fancy stuff
    let inside = 0
    let topLevelBlock = false
    let lastStart = 0
    for (let i = 1; i < text.length; i ++) {
        let thisAndLast = (text[i-1]+text[i])
        if (!topLevelBlock) topLevelBlock = (i===1&&thisAndLast==='{{')??(i>1&&(text[i-2]+text[i-1]+text[i])==='\n{{')
        if (thisAndLast==='{{') {
            if (inside===0) lastStart = i-1
            inside++
        }
        else if (thisAndLast==='}}') {
            inside--
            if (topLevelBlock&&inside===0) {
                let partToRemove = text.slice(lastStart, i+1)
                if (text[i+1]==='\n') partToRemove+='\n'
                text = text.replace(partToRemove, '')
                i=0
            }
        }
    }

    let html = wikity.parse(text)
    html = sanitizeHtml(html)
    let md = html2md(html, {
        ignoreTags: ['li','ol','ul','tr','figure']
    })
    return md
}
function doFormat(text) {
    const startSentenceRegExp = /^.*?\s(is|was)(\s)/
    text = wikitextToMd(text)
    text = text.replace(/\s\(.*?\)(\s|,|\.|\?|\!)/gm, '$1')
    text = text.replace(/<sup>.*?<\/sup>/gm, '')
    if (!startSentenceRegExp.test(text)) return ''
    text = text.replace(startSentenceRegExp, '$1 ')
    text = text.replace(/\[(.*?)\]\(.*?\)/gm, (e) => {
        let text = e.match(/\[(.*?)\]\(.*?\)/)[1]
        let linkText = text.replace(/\. /gm, 'PERIODSPACEAAAAAAWOOO')
        return linkText
    })
    text = text.replace(/(\.|\!|\?|:)(\s|\n)/gm, '$1$2OKAYTHISISOVERGOODBYEWOWOWOWSPLIT')
    sentences = text.split('OKAYTHISISOVERGOODBYEWOWOWOWSPLIT')
    let secondSentence = sentences[1].split(/\s/gm)
    while (secondSentence.length<3) {
        sentences[0] += sentences[1]
        sentences = sentences.splice(1, 1)
        secondSentence = sentences[1].split(/\s/gm)
    }
    text = sentences[0]
    text = text.replace(/PERIODSPACEAAAAAAWOOO/gm, '. ')
    return `she's a 10, but she ${text}`
}

function getCategoriesFromContent(text) {
    text = text.trim()
    text += '\n'
    let cats = text.match(/\[\[Category:.*?\]\]/gm)
    if (!cats) return []
    cats = cats.map(e => e.slice(2, -2).split(':').slice(1).join(':').split('|')[0])
    return cats
}

function filterResults(arr) {
    return arr.filter(e => {
        let wordsInText = e.content.split(/\s/gm)
        if (wordsInText.length<10) return
        let badTitles = [
            /Lists? of .*?/.test(e),
            /.*? \(disambiguation\)/.test(e)
        ].filter(Boolean)
        if (badTitles.length>0) return
        let foundCategories = e.categories.find(e => {
            let isCategory = [
                /.*? deaths/.test(e),
                /.*? births/.test(e),
                /.*? deaths/.test(e),
                /.*? families/.test(e),
                /^.*? organizations .*?$/.test(e),
                /Towns .*?/.test(e),
                /Areas .*?/.test(e),
                /Coordinates on .*?/.test(e),
                /History of .*?/.test(e),
                /History .*?/.test(e),
                /Buildings .*?/.test(e),
                /Communes .*?/.test(e),
                /Cities .*?/.test(e),
                /Landforms .*?/.test(e),
                /Villages .*?/.test(e),
                /Year of birth .*?/.test(e),
                /Year of death .*?/.test(e),
                /Military .*?/.test(e),
                /Wars? .*?/.test(e),
                /Terrorists? .*?/.test(e),
                /Conflicts? .*?/.test(e),
                /Microregions .*?/.test(e),
                /Autonomous communities .*?/.test(e),
                /States and territories .*?/.test(e),
                /surnames/.test(e),
                /All articles with unsourced statements/.test(e),
                /Disambiguation pages/gm.test(e)
            ].filter(Boolean)
            return isCategory.length>0
        })
        return (!foundCategories)
    })
}

async function run() {
    let randFetch = await fetch(API_URL)
    let resp = (await randFetch.json()).query.pages.map(e => {
        let lastRev = {
            ...e.revisions[0]
        }
        let cats = getCategoriesFromContent(lastRev['content'])
        lastRev['content'] = doFormat(lastRev['content'])
        // lastRev[]
        return {
            title: e.title,
            categories: [
                ...e.categories?.map(e => e.title.split(':').slice(1).join(':'))??[],
                ...cats
            ],
            ...lastRev
        }
    })
    console.log(
        filterResults(resp)
            .sort((a, b) => a.content.length - b.content.length)
            .map(e => `${e.content}`).join('\n\n\n')
    )
}
run()