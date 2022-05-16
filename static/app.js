import { courses as pulnoyCourses } from 'dewep/uxgolf/courses/pulnoy'

export default {
  data () {
    return {
      coursesData: [...pulnoyCourses],
      matchesData: JSON.parse(localStorage.matches || '[]'),

      courseSelection: false,

      matchSlug: null,
      hole: null,

      currentPosLat: 48.701195,
      currentPosLng: 6.264620
    }
  },

  computed: {
    matches () {
      return this.matchesData.map(match => {
        const date = new Date(match.date).toLocaleString('fr-FR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
        const course = this.coursesData.find(course => course.slug === match.course)
        const starter = course.starters.find(starter => starter.slug === match.starter)
        return {
          slug: match.date,
          title: `${date} - ${match.player} (${match.index})`,
          subtitle: `${course.name} - ${starter.name} - ${match.strokes.length} strokes`
        }
      })
    },

    match () {
      return this.matchesData.find(match => match.date === this.matchSlug)
    },
    matchTitle () {
      const date = new Date(this.match.date).toLocaleString('fr-FR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
      return `${date} - ${this.match.player} (${this.match.index})`
    },
    course () {
      return this.coursesData.find(course => course.slug === this.match.course)
    },
    starter () {
      return this.course.starters.find(starter => starter.slug === this.match.starter)
    },

    coursePar () {
      return this.course.holes.map(hole => hole.par).reduce((a, b) => a + b, 0)
    },
    handicap () {
      return Math.round(this.match.index * this.starter.slope / 113 + (this.starter.sss - this.coursePar))
    },
    cr () {
      const extra = this.handicap % this.course.holes.length
      const cr = this.handicap / this.course.holes.length
      return this.course.holes.map((hole, index) => {
        if (hole.hcp <= extra) {
          return Math.ceil(cr)
        }
        return Math.floor(cr)
      })
    },

    summary () {
      return this.getSummary(this.match.strokes)
    },
    nextHoleNumber () {
      for (let i = 1; i <= this.course.holes.length; i++) {
        if (!this.summary.holes[i - 1].played) {
          return i
        }
      }
      return 1
    },

    currentHole () {
      return this.course.holes[this.hole - 1]
    },
    currentDistance () {
      return this.distanceGps(this.currentPosLat, this.currentPosLng, this.currentHole.lat, this.currentHole.lng)
    },
    currentSummary () {
      return this.summary.holes[this.hole - 1]
    },
    currentStrokes () {
      const strokes = this.match.strokes.filter(stroke => stroke.hole === this.hole)
      const currentStrokes = []
      for (let i = 0; i < strokes.length; i++) {
        const distanceHole = this.distanceGps(strokes[i].lat, strokes[i].lng, this.currentHole.lat, this.currentHole.lng)
        const green = distanceHole < 30
        let distanceNextStroke = 0
        if (!green) {
          distanceNextStroke = i + 1 < strokes.length ? this.distanceGps(strokes[i].lat, strokes[i].lng, strokes[i + 1].lat, strokes[i + 1].lng) : 0
        }
        const time = new Date(strokes[i].date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        currentStrokes.push({
          date: strokes[i].date,
          label: time,
          green,
          distance: distanceNextStroke < 10 ? null : (distanceNextStroke || distanceHole),
          lat: strokes[i].lat,
          lng: strokes[i].lng
        })
      }
      return currentStrokes
    },

    svgData () {
      const svg = this.currentHole.svg
      if (!svg) {
        return null
      }

      const { a, b, c } = svg.points

      const lines = []
      const texts = []

      let lastPoint = null
      const circles = this.currentStrokes.map(stroke => {
        const point = this.gpsToPoint(a, b, c, stroke.lat, stroke.lng)
        if (lastPoint) {
          lines.push({
            x1: lastPoint.x,
            y1: lastPoint.y,
            x2: point.x,
            y2: point.y
          })
        }
        if (point) {
          lastPoint = point
        }
        if (stroke.distance) {
          texts.push({
            x: point.x + 10,
            y: point.y + 4,
            text: `${stroke.distance}m`
          })
        }
        return { x: point.x - 5, y: point.y - 5 }
      }).filter(point => point)

      return {
        ...svg,
        circles,
        lines,
        texts
      }
    }
  },

  mounted () {
    const importMatchData = window.location.hash.match(/^#import\/(.+)$/)
    if (importMatchData) {
      this.importMatchData(importMatchData[1])
      window.location.hash = ''
    }

    const importMatchJsonFile = window.location.hash.match(/^#import-match\/(.+)$/)
    if (importMatchJsonFile) {
      this.importMatchJsonFile(importMatchJsonFile[1])
      window.location.hash = ''
    }

    if (window.localStorage.strokes) {
      const strokes = JSON.parse(window.localStorage.strokes)
      if (strokes.length) {
        const match = {
          date: strokes[0].date,
          player: 'Dewep',
          index: 54,
          course: '54425-pulnoy-18t',
          starter: 'blue-men',
          strokes
        }
        this.matchesData.unshift(match)
        this.matchSlug = match.date
        this.saveLocalStorage()
      }
      delete window.localStorage.strokes
    }

    if (window.location.protocol === 'https:') {
      this.watchLocation()
    }

    window.newStroke = (lat, lng) => {
      this.newStroke(lat, lng)
    }
  },

  methods: {
    watchLocation () {
      navigator.geolocation.watchPosition(position => {
        this.currentPosLat = position.coords.latitude
        this.currentPosLng = position.coords.longitude
      }, console.warn, {
        enableHighAccuracy: true,
        maximumAge: 0
      })
    },

    getSummary (strokes) {
      const summary = {
        total: { brut: 0, net: 0, index: 0 },
        holes: []
      }
      for (let i = 1; i <= this.course.holes.length; i++) {
        const hole = this.course.holes[i - 1]
        const holeStrokes = strokes.filter(stroke => stroke.hole === i)
        const played = !!holeStrokes.length
        const holeSummary = {
          played,
          par: hole.par,
          hcp: hole.hcp,
          brut: played ? holeStrokes.length : (hole.par + this.cr[i - 1]),
          net: played ? (holeStrokes.length - hole.par - this.cr[i - 1]) : 0
        }
        summary.holes.push(holeSummary)
        summary.total.brut += holeSummary.brut
        summary.total.net += holeSummary.net
      }
      summary.total.index = this.match.index + summary.total.net
      return summary
    },

    distanceGps (lat1, lon1, lat2, lon2) {
      const R = 6371000 // metres
      const dLat = (lat2-lat1) * Math.PI / 180
      const dLon = (lon2-lon1) * Math.PI / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      const d = R * c
      return Math.ceil(d)
    },
    distancePoints (x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1)
    },
    circleIntersections (x1, y1, r1, x2, y2, r2) {
      let dx = x2 - x1
      let dy = y2 - y1
      const d = Math.sqrt(dx * dx + dy * dy)

      if (d > r1 + r2) {
        console.warn('Circles too far apart')
        return null
      }
      if (d < Math.abs(r1 - r2)) {
        console.warn('One circle completely inside the other')
        return null
      }
      dx /= d
      dy /= d
      const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
      const px = x1 + a * dx
      const py = y1 + a * dy
      const h = Math.sqrt(r1 * r1 - a * a)

      return {
        x1: px + h * dy,
        y1: py - h * dx,
        x2: px - h * dy,
        y2: py + h * dx
      }
    },
    gpsToPoint (a, b, c, lat, lng) {
      const distABGps = this.distanceGps(a.lat, a.lng, b.lat, b.lng)
      const distABSvg = this.distancePoints(a.x, a.y, b.x, b.y)
      const distMultiplier = distABSvg / distABGps

      const distancesGps = {
        a: distMultiplier * this.distanceGps(a.lat, a.lng, lat, lng),
        b: distMultiplier * this.distanceGps(b.lat, b.lng, lat, lng),
        c: distMultiplier * this.distanceGps(c.lat, c.lng, lat, lng)
      }
      const ca = { x: a.x, y: a.y, r: distancesGps.a }
      const cb = { x: b.x, y: b.y, r: distancesGps.b }

      const intersections = this.circleIntersections(ca.x, ca.y, ca.r, cb.x, cb.y, cb.r)

      if (!intersections) {
        return null
      }

      const distC1 = this.distancePoints(c.x, c.y, intersections.x1, intersections.y1)
      const distC2 = this.distancePoints(c.x, c.y, intersections.x2, intersections.y2)

      if (Math.abs(distC1 - distancesGps.c) < Math.abs(distC2 - distancesGps.c)) {
        return { x: intersections.x1, y: intersections.y1 }
      }
      return { x: intersections.x2, y: intersections.y2 }
    },

    prevHole () {
      if (this.hole === 1) {
        this.hole = null
      } else if (this.hole === null) {
        this.hole = this.course.holes.length
      } else {
        this.hole -= 1
      }
    },

    nextHole () {
      if (this.hole === this.course.holes.length) {
        this.hole = null
      } else if (this.hole === null) {
        this.hole = 1
      } else {
        this.hole += 1
      }
    },

    updateStrokeGps ({ date }, position, modifier) {
      const stroke = this.match.strokes.find(stroke => stroke.date === date)
      if (stroke) {
        stroke[position] += modifier * 0.00001
      }
      this.saveLocalStorage()
    },
    newStroke (lat = null, lng = null) {
      if (this.currentSummary.net >= 2) {
        return
      }
      this.match.strokes.push({
        hole: this.hole,
        date: new Date().toISOString(),
        lat: lat || this.currentPosLat,
        lng: lng || this.currentPosLng
      })
      this.saveLocalStorage()
    },

    selectCourse (course, starter) {
      if (this.match) {
        this.match.course = course.slug
        this.match.starter = starter.slug
      } else {
        const match = {
          date: new Date().toISOString(),
          player: 'Dewep',
          index: 54,
          course: course.slug,
          starter: starter.slug,
          strokes: []
        }
        this.matchesData.unshift(match)
        this.matchSlug = match.date
      }
      this.courseSelection = false
      this.saveLocalStorage()
    },

    copyToExport (jsonOnly = false) {
      let content = JSON.stringify(this.match)
      if (!jsonOnly) {
        const exportData = encodeURIComponent(window.btoa(content))
        content = window.location.href + '#import/' + exportData
      }
      navigator.clipboard.writeText(content)
    },
    importMatchData (data) {
      try {
        const match = JSON.parse(atob(decodeURIComponent(data)))
        this.importMatch(match)
      } catch (err) {
        console.warn('Error importing matchData', err)
      }
    },
    async importMatchJsonFile (slug) {
      try {
        const response = await fetch(`./matches/${slug}.json`)
        const match = await response.json()
        this.importMatch(match)
      } catch (err) {
        console.warn('Error importing matchJsonFile', err)
      }
    },
    importMatch (match) {
      this.matchesData = this.matchesData.filter(match => match.date !== match.date)
      this.matchesData.unshift(match)
      this.matchSlug = match.date
      this.saveLocalStorage()
    },

    deleteMatch () {
      this.matchesData = this.matchesData.filter(match => match.date !== this.matchSlug)
      this.matchSlug = null
      this.saveLocalStorage()
    },

    saveLocalStorage () {
      window.localStorage.matches = JSON.stringify(this.matchesData)
    }
  }
}
