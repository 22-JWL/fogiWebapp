import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import './ConcertPoster.css'

interface PosterItem {
  id: number
  title: string
  date: string
  venue: string
  imageColor: string
}

const posterItems: PosterItem[] = [
  {
    id: 1,
    title: '2025 정기 공연',
    date: '2025.03.15',
    venue: '대강당',
    imageColor: 'linear-gradient(180deg, #1a1a2e 0%, #4a1942 100%)'
  },
  {
    id: 2,
    title: '교내 축제',
    date: '2025.05.20',
    venue: '야외무대',
    imageColor: 'linear-gradient(180deg, #0f3460 0%, #16213e 100%)'
  }
]

export default function ConcertPoster() {
  return (
    <div className="concert-poster-section">
      <div className="section-header">
        <h2>공연 포스터</h2>
      </div>
      <Swiper
        modules={[FreeMode]}
        freeMode={true}
        slidesPerView="auto"
        spaceBetween={12}
        className="poster-swiper"
      >
        {posterItems.map((poster) => (
          <SwiperSlide key={poster.id} className="poster-slide">
            <div
              className="poster-card"
              style={{ background: poster.imageColor }}
            >
              <div className="poster-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 19V6l12-3v13" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
              <div className="poster-info">
                <h3 className="poster-title">{poster.title}</h3>
                <p className="poster-date">{poster.date}</p>
                <p className="poster-venue">{poster.venue}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
