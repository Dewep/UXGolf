import { courses as pulnoyCourses } from 'dewep/uxgolf/courses/pulnoy'

export default {
  data () {
    return {
      coursesData: [...pulnoyCourses],
      matchesData: JSON.parse(localStorage.matches || '[]'),

      loading: false,
      remoteMatches: [],

      courseSelection: false,

      matchSlug: null,
      hole: null,
      player: null,

      currentPosLat: 48.701195,
      currentPosLng: 6.264620
    }
  },

  computed: {
    matches () {
      const matches = []

      const addMatch = (match, remote = false) => {
        const date = new Date(match.date).toLocaleString('fr-FR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
        const course = this.coursesData.find(course => course.slug === match.course)
        const starter = course?.starters?.find(starter => starter.slug === match.starter)
        const subtitle = [
          course?.name || 'N/A',
          starter?.name || 'N/A',
          match.strokes ? `${match.strokes.length} strokes` : null
        ]
        matches.push({
          slug: match.slug || match.date,
          dateInstance: date,
          remote,
          title: `${date} - ${match.player} (${match.index})`,
          subtitle: subtitle.filter(part => part).join(' - ')
        })
      }

      for (const match of this.matchesData) {
        addMatch(match, false)
      }

      for (const match of this.remoteMatches) {
        if (!matches.find(m => m.slug === match.slug)) {
          addMatch(match, true)
        }
      }

      matches.sort((a, b) => {
        if (a.dateInstance < b.dateInstance) {
          return 1
        }
        if (a.dateInstance > b.dateInstance) {
          return -1
        }
        return 0
      })

      return matches
    },

    localMatch () {
      return this.matchesData.find(match => match.slug === this.matchSlug || match.date === this.matchSlug)
    },
    remoteMatch () {
      const remoteMatch = this.remoteMatches.find(match => match.slug === this.matchSlug)
      if (remoteMatch && remoteMatch.strokes) {
        return remoteMatch
      }
      return null
    },
    match () {
      return this.localMatch || this.remoteMatch
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
      let nbOfPointsInTheSamePosition = -1
      const circles = this.currentStrokes.map(stroke => {
        nbOfPointsInTheSamePosition += 1

        const point = this.gpsToPoint(a, b, c, stroke.lat, stroke.lng)
        if (!point) {
          return null
        }

        if (lastPoint) {
          const distanceWithLastPoint = this.distancePoints(lastPoint.x, lastPoint.y, point.x, point.y)
          if (distanceWithLastPoint < 10) {
            lastPoint.distance = stroke.distance
            return null
          }

          lines.push({
            x1: lastPoint.x,
            y1: lastPoint.y,
            x2: point.x,
            y2: point.y
          })

          const text = [
            lastPoint.distance ? `${lastPoint.distance}m` : null,
            nbOfPointsInTheSamePosition > 1 ? `(${nbOfPointsInTheSamePosition} strokes)` : null
          ].filter(part => part).join(' ')
          if (text) {
            texts.push({
              x: lastPoint.x + 10,
              y: lastPoint.y + 4,
              text
            })
          }

          nbOfPointsInTheSamePosition = 0
        }

        lastPoint = {
          ...point,
          distance: stroke.distance
        }

        return { x: point.x - 5, y: point.y - 5 }
      }).filter(point => point)

      if (lastPoint && nbOfPointsInTheSamePosition > 0) {
        texts.push({
          x: lastPoint.x + 10,
          y: lastPoint.y + 4,
          text: `(${nbOfPointsInTheSamePosition + 1} strokes)`
        })
      }

      if (this.currentDistance < 600) {
        const currentPosition = this.gpsToPoint(a, b, c, this.currentPosLat, this.currentPosLng)
        if (currentPosition) {
          circles.push({ x: currentPosition.x - 5, y: currentPosition.y - 5, stroke: '#0E4706', fill: '#FFF' })
        }
      }

      return {
        ...svg,
        circles,
        lines,
        texts
      }
    }
  },

  mounted () {
    this.loadRemoteMatches()

    if (window.location.protocol === 'https:') {
      this.watchLocation()
    }

    window.newStroke = (lat, lng) => {
      this.newStroke(lat, lng)
    }
  },

  watch: {
    matchSlug: {
      handler () {
        if (!this.matchSlug) {
          return
        }
        if (!this.match || (this.match.slug && !this.remoteMatch)) {
          this.loadMatch(this.matchSlug)
        }
      },
      immediate: true
    }
  },

  methods: {
    async loadRemoteMatches () {
      try {
        this.loading = true

        const response = await fetch('/matches/')
        const json = await response.json()

        this.remoteMatches = []

        for (const match of json.matches) {
          if (!match) { // null at the end of the list
            continue
          }
          if (this.remoteMatches.find(m => m.slug === match.slug)) {
            continue
          }
          this.remoteMatches.push({
            slug: match.slug,
            date: match.date,
            player: match.player,
            index: match.index,
            course: match.course,
            starter: match.starter,
            strokes: null
          })
        }
      } catch (error) {
        console.warn('Cannot load remote matches', error.message)
      }

      this.loading = false
    },

    async loadMatch (matchSlug) {
      try {
        this.loading = true

        const response = await fetch(`/matches/load/${matchSlug}.json`)
        const match = await response.json()

        this.remoteMatches = this.remoteMatches.filter(remoteMatch => remoteMatch.slug !== matchSlug)
        this.remoteMatches.push({
          slug: matchSlug,
          ...match
        })
      } catch (error) {
        console.warn('Cannot load remote matches', error.message)
        this.matchSlug = null
      }

      this.loading = false
    },

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
      let h = Math.sqrt(r1 * r1 - a * a)

      if (isNaN(h)) {
        h = 0
        console.warn('h is not a number', r1, a)
      }

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
    removeStrokeGps ({ date }) {
      this.match.strokes = this.match.strokes.filter(stroke => stroke.date !== date)
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
          player: this.player || 'Dewep',
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

    importRemoteMatch () {
      this.matchesData.unshift(this.match)
      this.saveLocalStorage()
    },
    async createRemoteMatch () {
      this.saveRemoteMatch(true)
    },
    async saveRemoteMatch (creation = false) {
      try {
        this.loading = true

        if (!this.localMatch.slug && !creation) {
          throw new Error('Couln\'t save match without slug')
        }
        const match = {
          slug: this.localMatch.slug || window.btoa(this.localMatch.date),
          ...this.localMatch
        }

        const jsonMatch = JSON.stringify(match)
        await fetch(`/matches/import/${match.slug}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: jsonMatch
        })

        this.remoteMatches = this.remoteMatches.filter(remoteMatch => remoteMatch.slug !== match.slug)
        this.remoteMatches.push(JSON.parse(jsonMatch))

        if (!this.localMatch.slug) {
          this.localMatch.slug = match.slug
          this.matchSlug = match.slug
          this.saveLocalStorage()
        }
      } catch (error) {
        console.warn('Cannot save remote match', error.message)
      }

      this.loading = false
    },
    restoreRemoteMatch () {
      if (!this.remoteMatch) {
        return
      }
      this.matchesData = this.matchesData.filter(match => match.slug !== this.matchSlug)
      this.matchesData.unshift(JSON.parse(JSON.stringify(this.remoteMatch)))
      this.saveLocalStorage()
    },
    removeLocalMatch () {
      if (!this.remoteMatch) {
        return
      }
      this.matchesData = this.matchesData.filter(match => match.slug !== this.matchSlug)
      this.saveLocalStorage()
    },
    permanentlyDeleteMatch () {
      this.matchesData = this.matchesData.filter(match => match.date !== this.matchSlug)
      this.matchSlug = null
      this.saveLocalStorage()
    },

    saveLocalStorage () {
      window.localStorage.matches = JSON.stringify(this.matchesData)
    }
  }
}
