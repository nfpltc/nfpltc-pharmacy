"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Script from "next/script"

// ============================================================
// TOGGLE: Set NEXT_PUBLIC_HERO_3D="spline" in Vercel env vars
// to switch back to Spline. Default is the Three.js pill.
// ============================================================
const USE_SPLINE = process.env.NEXT_PUBLIC_HERO_3D === "spline"
const SPLINE_URL = "https://my.spline.design/pillanddnaanimation-4ZBRcKlnjem5rcSWxYkgTqOp/"

function SplineEmbed() {
  return (
    <iframe
      src={SPLINE_URL}
      frameBorder="0"
      className="absolute inset-0 w-full h-full object-contain"
      allow="autoplay; fullscreen"
    />
  )
}

function PillScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const waitForThree = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).THREE && canvasRef.current) {
        clearInterval(waitForThree)
        initScene()
      }
    }, 100)

    function initScene() {
      const THREE = (window as any).THREE
      const cv = canvasRef.current!
      const W = cv.clientWidth || 500
      const H = cv.clientHeight || 500

      const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(W, H)
      renderer.setClearColor(0x000000, 0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15

      const scene = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100)
      cam.position.set(0, 0.3, 7.5)
      cam.lookAt(0, 0, 0)

      scene.add(new THREE.AmbientLight(0xffffff, 0.5))
      const key = new THREE.DirectionalLight(0xffffff, 0.95)
      key.position.set(5, 6, 8)
      scene.add(key)
      const fill = new THREE.DirectionalLight(0x7fccb8, 0.3)
      fill.position.set(-5, 3, 4)
      scene.add(fill)
      const rim = new THREE.DirectionalLight(0x0ea171, 0.5)
      rim.position.set(-3, -1, 4)
      scene.add(rim)
      const bot = new THREE.DirectionalLight(0x8fbfa8, 0.25)
      bot.position.set(0, -5, 2)
      scene.add(bot)
      const pt = new THREE.PointLight(0x115e59, 0.4, 10)
      pt.position.set(0, 0, 2.5)
      scene.add(pt)

      const pill = new THREE.Group()
      const R = 0.54, hH = 0.9

      const tealMat = new THREE.MeshPhongMaterial({
        color: 0x115e59, specular: 0x66bbaa, shininess: 115,
        emissive: 0x0a2f2c, emissiveIntensity: 0.15, transparent: true, opacity: 0.95,
      })
      const grayMat = new THREE.MeshPhongMaterial({
        color: 0xd4d4d4, specular: 0xffffff, shininess: 85,
        emissive: 0x1a1a1a, emissiveIntensity: 0.04,
      })
      const sealMat = new THREE.MeshPhongMaterial({
        color: 0xbbbbbb, specular: 0xffffff, shininess: 180,
        emissive: 0x111111, emissiveIntensity: 0.06,
      })

      const tc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, hH, 48, 1, true), tealMat)
      tc.position.y = hH / 2
      pill.add(tc)
      const ts = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), tealMat)
      ts.position.y = hH
      pill.add(ts)
      const bc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, hH, 48, 1, true), grayMat)
      bc.position.y = -hH / 2
      pill.add(bc)
      const bs = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), grayMat)
      bs.position.y = -hH
      pill.add(bs)
      const seal = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.018, 12, 48), sealMat)
      seal.rotation.x = Math.PI / 2
      pill.add(seal)
      const ig = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.8, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x115e59, transparent: true, opacity: 0.04 })
      )
      pill.add(ig)
      pill.rotation.z = -0.7
      pill.rotation.x = 0.12
      scene.add(pill)

      const orbitConfigs = [
        { rx: 3.0, ry: 1.05, tX: -0.35, tZ: 0, sp: 0.65, el: [{ o: 0, s: 0.09, c: 0x0ea171, e: 0x064e3b }, { o: Math.PI, s: 0.06, c: 0x5dcaa5, e: 0x2a7a5a }] },
        { rx: 2.6, ry: 0.92, tX: 0.3, tZ: 1.05, sp: -0.5, el: [{ o: 0.7, s: 0.08, c: 0x0b8f79, e: 0x055040 }, { o: 3.7, s: 0.05, c: 0x9fe1cb, e: 0x4a9070 }] },
        { rx: 3.3, ry: 1.15, tX: 0.5, tZ: -0.65, sp: 0.42, el: [{ o: 1.5, s: 0.07, c: 0x0ea171, e: 0x064e3b }, { o: 4.5, s: 0.06, c: 0x5dcaa5, e: 0x2a7a5a }] },
        { rx: 2.3, ry: 0.82, tX: -0.55, tZ: 1.9, sp: 0.8, el: [{ o: 2.2, s: 0.065, c: 0x0b7c79, e: 0x044540 }] },
      ]

      const orbs: any[] = []
      orbitConfigs.forEach((cfg) => {
        const g = new THREE.Group()
        g.rotation.x = cfg.tX
        g.rotation.z = cfg.tZ
        const cur = new THREE.EllipseCurve(0, 0, cfg.rx, cfg.ry, 0, Math.PI * 2, false, 0)
        const pts = cur.getPoints(120)
        const lg = new THREE.BufferGeometry().setFromPoints(pts.map((p: any) => new THREE.Vector3(p.x, p.y, 0)))
        g.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x0ea171, transparent: true, opacity: 0.1 })))
        const els: any[] = []
        cfg.el.forEach((e) => {
          const m = new THREE.MeshPhongMaterial({ color: e.c, emissive: e.e, emissiveIntensity: 0.7, shininess: 100, transparent: true, opacity: 0.95 })
          const sp = new THREE.Mesh(new THREE.SphereGeometry(e.s, 16, 16), m)
          const gm = new THREE.MeshBasicMaterial({ color: e.c, transparent: true, opacity: 0.1 })
          sp.add(new THREE.Mesh(new THREE.SphereGeometry(e.s * 3.5, 8, 8), gm))
          g.add(sp)
          els.push({ mesh: sp, off: e.o })
        })
        scene.add(g)
        orbs.push({ g, cfg, els })
      })

      const sN = 250
      const sG = new THREE.BufferGeometry()
      const sA = new Float32Array(sN * 3)
      for (let i = 0; i < sN; i++) {
        sA[i * 3] = (Math.random() - 0.5) * 22
        sA[i * 3 + 1] = (Math.random() - 0.5) * 16
        sA[i * 3 + 2] = (Math.random() - 0.5) * 10 - 4
      }
      sG.setAttribute("position", new THREE.BufferAttribute(sA, 3))
      scene.add(new THREE.Points(sG, new THREE.PointsMaterial({ color: 0x0ea171, size: 0.03, transparent: true, opacity: 0.2 })))

      const cG = new THREE.Group()
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Group()
        const bm = new THREE.MeshBasicMaterial({ color: 0x0ea171, transparent: true, opacity: 0.1 })
        c.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), bm))
        c.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), bm))
        c.position.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3 - 2)
        c.userData = { vy: (Math.random() - 0.5) * 0.002, vr: (Math.random() - 0.5) * 0.004 }
        cG.add(c)
      }
      scene.add(cG)

      let mX = 0, mY = 0
      cv.addEventListener("mousemove", (ev: MouseEvent) => {
        const r = cv.getBoundingClientRect()
        mX = ((ev.clientX - r.left) / r.width - 0.5) * 2
        mY = -((ev.clientY - r.top) / r.height - 0.5) * 2
      })

      let T = 0
      function loop() {
        requestAnimationFrame(loop)
        T += 0.016
        pill.rotation.y += 0.004
        pill.rotation.x = 0.12 + mY * 0.1
        pill.rotation.z = -0.7 + mX * 0.06
        pill.position.y = Math.sin(T * 0.5) * 0.05
        ig.scale.setScalar(1 + Math.sin(T * 1.8) * 0.1)
        orbs.forEach((ob: any) => {
          ob.els.forEach((el: any) => {
            const a = T * ob.cfg.sp + el.off
            el.mesh.position.set(Math.cos(a) * ob.cfg.rx, Math.sin(a) * ob.cfg.ry, 0)
            el.mesh.children[0].scale.setScalar(1 + Math.sin(T * 3 + el.off) * 0.2)
          })
        })
        cG.children.forEach((c: any) => {
          c.position.y += c.userData.vy
          c.rotation.z += c.userData.vr
          if (c.position.y > 3.5 || c.position.y < -3.5) c.userData.vy *= -1
        })
        pt.intensity = 0.35 + Math.sin(T * 2) * 0.1
        renderer.render(scene, cam)
      }
      loop()

      const onResize = () => {
        const w = cv.clientWidth || 500
        const h = cv.clientHeight || 500
        cam.aspect = w / h
        cam.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener("resize", onResize)
    }

    return () => clearInterval(waitForThree)
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: "none" }} />
}

export function Hero() {
  return (
    <>
      {/* Only load Three.js if not using Spline */}
      {!USE_SPLINE && (
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
          strategy="afterInteractive"
        />
      )}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-8 pt-10 md:grid-cols-2 md:gap-12 lg:pb-16">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            Your Trusted Cape Cod Pharmacy for Over 30 Years
          </div>

          <h1 className="text-pretty text-4xl font-semibold leading-tight md:text-5xl">
            Real Pharmacists. Real Support. 24/7 for your Residents.
          </h1>

          <p className="max-w-prose text-muted-foreground">
            Helpful, accurate guidance from licensed pharmacists whenever you need it.
            We collaborate with providers and support patients with clarity and care.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/forms/enrollment" passHref>
              <Button className="bg-orange-500 text-white hover:bg-orange-600">
                Get Started
              </Button>
            </Link>
            <Link href="/services" passHref>
              <Button variant="outline">Learn More</Button>
            </Link>
          </div>
        </div>

        {/* Right column → 3D Animation (Three.js or Spline) */}
        <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px]">
          {USE_SPLINE ? <SplineEmbed /> : <PillScene />}
        </div>
      </section>
    </>
  )
}
