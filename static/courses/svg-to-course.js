#!/usr/bin/node

const fs = require('fs').promises

const result = {
  points: {
    a: { lat: null, lng: null, x: null, y: null },
    b: { lat: null, lng: null, x: null, y: null },
    c: { lat: null, lng: null, x: null, y: null }
  },
  course: [],
  fairway: [],
  water: [],
  sand: [],
  green: []
}

function extractPaths (svg, fill) {
  const regexContent = `<path id="[^"]+" data-name="[^"]+" d="([^"]+)" transform="translate\\((-?[0-9\\.]+) (-?[0-9\\.]+)\\)" fill="${fill}"\/>`
  const regexGlobal = new RegExp(regexContent, 'gi')
  const regexOne = new RegExp(regexContent, 'i')

  const paths = svg.match(regexGlobal)

  const extract = []

  if (paths) {
    for (const path of paths) {
      const [, d, translateX, translateY] = path.match(regexOne)
      extract.push({ d, transform: `translate(${translateX} ${translateY})` })
    }
  }

  return extract
}

function extractPoints (svg) {
  const regexContent = `<g id="[^"]+" data-name="(-?[0-9\\.]+), (-?[0-9\\.]+)" transform="translate\\((-?[0-9\\.]+) (-?[0-9\\.]+)\\)" fill="#fff" stroke="red" stroke-width="1">`
  const regexGlobal = new RegExp(regexContent, 'gi')
  const regexOne = new RegExp(regexContent, 'i')

  const paths = svg.match(regexGlobal)

  const points = ['a', 'b', 'c']

  for (let index = 0; index < points.length; index++) {
    const [, lat, lng, translateX, translateY] = paths[index].match(regexOne)
    result.points[points[index]].lat = +lat
    result.points[points[index]].lng = +lng
    result.points[points[index]].x = +translateX
    result.points[points[index]].y = +translateY
  }
}

async function svgToCourse (svgPath) {
  const svg = await fs.readFile(svgPath, 'utf8')

  result.course = extractPaths(svg, '#dff1dc')
  result.fairway = extractPaths(svg, '#9dc592')
  result.water = extractPaths(svg, '#3EB6D5')
  result.sand = extractPaths(svg, '#e8b85a')
  result.green = extractPaths(svg, '#3ed59d')

  extractPoints(svg)

  console.log(result)
}

svgToCourse(process.argv[2]).catch(console.error)
