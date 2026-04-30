import { Instagram, Youtube, Facebook, Linkedin, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const socials = [
  { icon: Instagram, label: "Instagram", url: "https://www.instagram.com/smartdentoficial/", hover: "hover:text-pink-500" },
  { icon: Youtube, label: "YouTube", url: "https://www.youtube.com/@smartdentcadcam", hover: "hover:text-red-500" },
  { icon: Facebook, label: "Facebook", url: "https://www.facebook.com/smartdentoficial", hover: "hover:text-blue-600" },
  { icon: Linkedin, label: "LinkedIn", url: "https://www.linkedin.com/company/smartdent-brasil/", hover: "hover:text-sky-500" },
  { icon: MessageCircle, label: "WhatsApp", url: "https://api.whatsapp.com/send?phone=5516993831794", hover: "hover:text-green-500" },
];

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Coluna 1 — Sobre */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-lg">Smart Dent</h3>
            <p className="text-sm">CNPJ: 10.736.894/0001-36</p>
            <p className="text-sm">São Carlos, SP · Brasil</p>
            <p className="text-sm">Charlotte, NC · USA</p>
          </div>

          {/* Coluna 2 — Redes Sociais */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">Redes Sociais</h4>
            <div className="flex gap-3">
              {socials.map(({ icon: Icon, label, url, hover }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center transition-colors ${hover}`}
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Coluna 3 — Links */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Parâmetros 3D</Link></li>
              <li><Link to="/base-conhecimento" className="hover:text-white transition-colors">Base de Conhecimento</Link></li>
              <li><a href="https://loja.smartdent.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Loja Online</a></li>
              <li><a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">smartdent.com.br</a></li>
              <li><a href="https://smartdentusa.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Smart Dent USA</a></li>
            </ul>
          </div>

          {/* Coluna 4 — Contato */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">Contato</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="tel:+551634194735" className="hover:text-white transition-colors">+55 16 3419-4735</a></li>
              <li><a href="tel:+17047556220" className="hover:text-white transition-colors">+1 704-755-6220</a></li>
              <li><a href="mailto:contato@smartdent.com.br" className="hover:text-white transition-colors">contato@smartdent.com.br</a></li>
              <li className="pt-2">ANVISA: 81835969003</li>
              <li>FDA: K260152</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-10 pt-6 text-center text-xs text-slate-400">
          © 2026 Smart Dent — MMTech Projetos Tecnológicos
        </div>
      </div>
    </footer>
  );
}

export default Footer;
