"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export interface HeroSlide {
  id: string;
  image: string;
  images?: string[];
  title: string;
  subtitle?: string;
  buttonText?: string;
  href?: string;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
}

export default function HeroCarousel({ slides }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideImages, setSlideImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
    const prevSlide = slides[prevIndex];
    if (prevSlide && prevSlide.images && prevSlide.images.length > 1) {
      const randomImg = prevSlide.images[Math.floor(Math.random() * prevSlide.images.length)];
      setSlideImages((prev) => ({ ...prev, [prevSlide.id]: randomImg }));
    }
  }, [currentIndex, slides]);

  if (!slides || slides.length === 0) return null;

  return (
    <section className="hero">
      {slides.map((slide, index) => {
        const isActive = index === currentIndex;
        const currentImage = slideImages[slide.id] || slide.image;
        return (
          <div
            key={slide.id}
            className={`hero__slide ${isActive ? "hero__slide--active" : ""}`}
            aria-hidden={!isActive}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImage} alt={slide.title} />
            <div className="hero__inner">
              {slide.subtitle && <p className="hero__sub">{slide.subtitle}</p>}
              {slide.title && <h1 className="hero__title">{slide.title}</h1>}
              {slide.buttonText && slide.href && (
                <Link
                  href={slide.href}
                  className="btn btn-lg btn-outline hero__btn"
                >
                  {slide.buttonText}
                </Link>
              )}
            </div>
          </div>
        );
      })}

      {slides.length > 1 && (
        <div className="hero__lines">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              className={`hero__line ${index === currentIndex ? "hero__line--active" : ""}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
