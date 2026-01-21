import './Footer.css'

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-grid">
        <div className="footer-column">
          <h3 className="footer-title">CONTACT US</h3>
          <p className="footer-desc">
            공연문의 언제든 환영합니다 편하게 연락주세요!
          </p>
          <p className="footer-desc-en">
            Interested in concert? Get in touch with us!
          </p>
          <div className="footer-emails">
            <a href="mailto:jck1oo4ee@gmail.com">jck1004ee@gmail.com</a>
            <a href="mailto:jck1004ee@naver.com">jck1004ee@naver.com</a>
          </div>
        </div>

        <div className="footer-column">
          <h3 className="footer-title">UNIV.</h3>
          <p className="footer-info">한성대학교</p>

          <h3 className="footer-title mt">CLUB</h3>
          <p className="footer-info">Dizzying F.O.G.I.</p>
        </div>

        <div className="footer-column">
          <h3 className="footer-title">TEAM</h3>
          <ul className="footer-team">
            <li><span className="role">Dev</span> 이재욱</li>
            <li><span className="role">SUPPORT</span> 구합니다</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          © 2025 Dizzying F.O.G.I. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
