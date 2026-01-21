import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination, EffectFade } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-fade'
import './HeroBanner.css'

interface BannerItem {
  id: number
  title: string
  subtitle: string
  backgroundColor: string
  accentColor: string
}

const bannerItems: BannerItem[] = [
  {
    id: 1,
    title: 'BandMate',
    subtitle: '함께 만드는 음악, 함께 나누는 추억',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accentColor: '#a78bfa'
  },
  {
    id: 2,
    title: '새 학기 신입부원 모집',
    subtitle: '당신의 열정을 보여주세요',
    backgroundColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    accentColor: '#f5576c'
  },
  {
    id: 3,
    title: '정기 공연 준비 중',
    subtitle: '최고의 무대를 위해 달려갑니다',
    backgroundColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    accentColor: '#00f2fe'
  }
]

export default function HeroBanner() {
  return (
    <div className="hero-banner">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        autoplay={{
          delay: 4000,
          disableOnInteraction: false
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true
        }}
        loop={true}
        className="hero-swiper"
      >
        {bannerItems.map((item) => (
          <SwiperSlide key={item.id}>
            <div
              className="hero-slide"
              style={{ background: item.backgroundColor }}
            >
              <div className="hero-content">
                <h2 className="hero-title">{item.title}</h2>
                <p className="hero-subtitle">{item.subtitle}</p>
              </div>
              <div
                className="hero-decoration"
                style={{ borderColor: item.accentColor }}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
