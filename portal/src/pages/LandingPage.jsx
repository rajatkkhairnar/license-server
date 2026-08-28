import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import Hls from 'hls.js';
import { ChevronDown, ArrowRight, Sun } from 'lucide-react';
import './LandingPage.css';

const Navbar = () => {
  return (
    <nav className="landing-nav">
      <div className="landing-nav-left">
        {/* Sunburst icon (24x24px SVG) in white color */}
        <Sun color="white" size={22} />
      </div>
      <div className="landing-nav-center">
        <a href="#products" className="landing-nav-link">Products <ChevronDown size={14} /></a>
        <a href="#stories" className="landing-nav-link">Customer Stories</a>
        <a href="#resources" className="landing-nav-link">Resources</a>
        <a href="#pricing" className="landing-nav-link">Pricing</a>
      </div>
      <div className="landing-nav-right">
        <a href="https://license-server-orcin-seven.vercel.app/" className="landing-nav-btn">Start Free Trial</a>
      </div>
    </nav>
  );
};

const LandingPage = () => {
  const videoRef = useRef(null);
  const videoSrc = "https://stream.mux.com/T6oQJQ02cQ6N01TR6iHwZkKFkbepS34dkkIc9iukgy400g.m3u8";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((e) => console.log("Auto-play prevented:", e));
      });
      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = videoSrc;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch((e) => console.log("Auto-play prevented:", e));
      });
    }
  }, []);

  return (
    <div className="landing-page">
      <Navbar />

      {/* Video Background */}
      <div className="hero-video-container">
        <video
          ref={videoRef}
          className="hero-video"
          muted
          loop
          playsInline
          poster="https://images.unsplash.com/photo-1647356191320-d7a1f80ca777?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNobm9sb2d5JTIwbmV1cmFsJTIwbmV0d29ya3xlbnwxfHx8fDE3Njg5NzIyNTV8MA&ixlib=rb-4.1.0&q=80&w=1080"
        />
        <div className="hero-overlay" />
      </div>

      {/* Decorative Gradients */}
      <div className="hero-gradient-1" />
      <div className="hero-gradient-2" />

      {/* Content */}
      <div className="hero-content">
        <motion.h2 
          className="hero-pre-headline"
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
        >
          Built for Speed. Designed for Simplicity.
        </motion.h2>

        <motion.h1 
          className="hero-headline"
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Manage with Ease
        </motion.h1>

        <motion.p 
          className="hero-subheadline"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 0.7 }} 
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          The lightweight, offline-ready CRM built for modern labs. Automate data analysis and manage workflows with intuitive, effortless dashboards.
        </motion.p>

        <motion.div 
          className="hero-cta-container"
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <a href="https://license-server-orcin-seven.vercel.app/" className="hero-primary-btn">
            <span className="hero-primary-btn-text">Start Free Trial</span>
            <div className="hero-primary-btn-arrow">
              <ArrowRight size={18} />
            </div>
          </a>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingPage;
