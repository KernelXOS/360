import { CircleHelp, Globe, Link2, Moon, Settings, Sun, Waypoints } from 'lucide-react';

export type RailTab = 'escenas' | 'puntos' | 'encuadre' | 'ajustes';

const TABS: Array<{ id: RailTab; label: string; Icon: typeof Waypoints }> = [
  { id: 'escenas', label: 'Escenas', Icon: Waypoints },
  { id: 'puntos', label: 'Puntos de navegación', Icon: Link2 },
  { id: 'encuadre', label: 'Encuadre de la escena', Icon: Globe },
  { id: 'ajustes', label: 'Ajustes del tour', Icon: Settings },
];

interface Props {
  active: RailTab;
  theme: 'dark' | 'light';
  onSelect: (tab: RailTab) => void;
  onToggleTheme: () => void;
  onHelp: () => void;
}

export function IconRail({ active, theme, onSelect, onToggleTheme, onHelp }: Props) {
  return (
    <nav className="rail" aria-label="Secciones">
      <div className="rail__group">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`rail__btn${active === id ? ' rail__btn--on' : ''}`}
            onClick={() => onSelect(id)}
            title={label}
            aria-label={label}
            aria-current={active === id}
          >
            <Icon size={19} strokeWidth={1.6} />
          </button>
        ))}
      </div>

      <div className="rail__group">
        <button className="rail__btn" onClick={onHelp} title="Ayuda" aria-label="Ayuda">
          <CircleHelp size={19} strokeWidth={1.6} />
        </button>
        <button
          className="rail__btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? (
            <Moon size={19} strokeWidth={1.6} />
          ) : (
            <Sun size={19} strokeWidth={1.6} />
          )}
        </button>
      </div>
    </nav>
  );
}
