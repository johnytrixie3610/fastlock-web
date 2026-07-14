import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneCall, MapPin, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function RouteDisplay({ origin, destination, serviceType, onPriceCalculated }: {
  origin: string;
  destination: string;
  serviceType: 'doors' | 'car';
  onPriceCalculated: (price: number) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !destination) return;
    
    // Clear previous route
    polylinesRef.current.forEach(p => p.setMap(null));

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'viewport'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(p => {
          p.setOptions({ strokeColor: '#FF6B00', strokeWeight: 5 });
          p.setMap(map);
        });
        polylinesRef.current = newPolylines;
        if (routes[0].viewport) map.fitBounds(routes[0].viewport);

        const distMeters = routes[0].distanceMeters || 0;
        const distKm = distMeters / 1000;
        
        const now = new Date();
        let surcharge = 0;
        
        const hour = now.getHours();
        if (hour >= 18 || hour < 6) {
          surcharge += 300;
        }
        
        const day = now.getDay();
        if (day === 0 || day === 6) {
          surcharge += 200;
        }
        
        const dateString = `${now.getDate()}/${now.getMonth() + 1}`;
        const holidays = ['1/1', '1/5', '8/5', '5/7', '6/7', '28/9', '28/10', '17/11', '24/12', '25/12', '26/12'];
        if (holidays.includes(dateString)) {
          surcharge += 400;
        }

        const basePrice = serviceType === 'car' ? 1000 : 800;
        const distancePrice = Math.round(distKm * 35);
        const totalPrice = basePrice + distancePrice + surcharge;
        const roundedPrice = Math.round(totalPrice / 10) * 10;
        
        onPriceCalculated(roundedPrice);
      }
    }).catch(console.error);

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, map, origin, destination, serviceType, onPriceCalculated]);

  return null;
}

const SlotMachine = () => {
  const words = ["dveře", "auto", "cokoliv", "dveře"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev < words.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block relative text-brand-orange overflow-hidden h-[1.1em] w-[5.5em] align-bottom sm:ml-4 -mb-[0.05em]">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={index}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute left-0 w-full text-center"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const Calculator = () => {
  const [address, setAddress] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<'doors' | 'car'>('doors');

  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    
    // Initialize autocomplete
    autocompleteRef.current = new placesLib.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "cz" },
      fields: ['formatted_address', 'geometry'],
    });

    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        setAddress(place.formatted_address);
        if (place.geometry?.location) {
          setDestinationCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          });
        }
      }
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [placesLib]);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setIsCalculating(true);
    setPrice(null);
    setDestination(address);
    // If user types manually without autocomplete and submits, destinationCoords might be old or null,
    // but the RouteDisplay will still calculate based on the string 'destination'.
    // If they did use autocomplete, destinationCoords is already set and accurate.
  };

  const handlePriceCalculated = useCallback((calculatedPrice: number) => {
    setPrice(calculatedPrice);
    setIsCalculating(false);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 bg-brand-black border border-brand-lightgray p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-orange/10 blur-[80px] rounded-full pointer-events-none"></div>

      <div className="relative z-10">
        <h2 className="text-3xl sm:text-4xl font-heading font-black italic uppercase tracking-tighter mb-2">
          Odhad ceny výjezdu
        </h2>
        <p className="text-gray-400 font-medium mb-8">
          Jsme transparentní. Zjistěte orientační cenu předem.
        </p>

        <form onSubmit={handleCalculate} className="flex flex-col gap-4">
          <div className="flex bg-brand-gray p-1 rounded-xl border border-brand-lightgray">
            <button
              type="button"
              onClick={() => setServiceType('doors')}
              className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${
                serviceType === 'doors' 
                  ? 'bg-brand-orange text-brand-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Dveře
            </button>
            <button
              type="button"
              onClick={() => setServiceType('car')}
              className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${
                serviceType === 'car' 
                  ? 'bg-brand-orange text-brand-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Auto
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <MapPin className="w-5 h-5 text-gray-500" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Zadejte vaši adresu (Praha a okolí)..."
                className="w-full bg-brand-gray border border-brand-lightgray text-white placeholder-gray-500 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all font-medium"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isCalculating || !address.trim()}
              className="bg-brand-orange text-brand-black font-heading font-bold italic px-8 py-4 rounded-xl uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isCalculating ? (
                <span className="w-5 h-5 border-2 border-brand-black border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>Spočítat <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </div>
        </form>

        <div className="w-full h-64 sm:h-80 bg-brand-gray border border-brand-lightgray rounded-xl overflow-hidden relative flex items-center justify-center mt-8">
          <Map
            defaultCenter={{ lat: 50.0336, lng: 14.5085 }} // Approximate for V Jezirkach, Praha
            defaultZoom={10}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            disableDefaultUI={true}
          >
            <AdvancedMarker position={{ lat: 50.0336, lng: 14.5085 }} title="FastLock Základna">
              <Pin background="#FF6B00" glyphColor="#000" borderColor="#FF6B00" />
            </AdvancedMarker>
            
            {destinationCoords && destination && (
              <AdvancedMarker position={destinationCoords} title="Cílová adresa">
                <Pin background="#000000" glyphColor="#fff" borderColor="#000000" />
              </AdvancedMarker>
            )}

            {destination && (
              <RouteDisplay 
                origin="V Jezírkách, Praha" 
                destination={destination} 
                serviceType={serviceType}
                onPriceCalculated={handlePriceCalculated} 
              />
            )}
          </Map>

          <AnimatePresence>
            {price && !isCalculating && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-black/90 backdrop-blur-md px-6 py-4 rounded-xl border border-brand-orange shadow-2xl flex flex-col items-center min-w-[240px] z-20 pointer-events-none"
              >
                <div className="text-xs font-bold text-brand-orange uppercase tracking-widest mb-1">
                  Odhadovaná cena
                </div>
                <div className="text-3xl font-heading font-black italic text-white">
                  ~ {price.toLocaleString('cs-CZ')} Kč
                </div>
                <div className="text-xs text-gray-500 mt-1 italic text-center max-w-[220px]">
                  *V odhadu jsou již započítány případné příplatky za aktuální noční výjezd, víkend nebo svátek.
                </div>
              </motion.div>
            )}
            
            {isCalculating && (
               <div className="absolute inset-0 bg-brand-black/40 flex items-center justify-center backdrop-blur-[2px] z-10 pointer-events-none">
                 <span className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></span>
               </div>
            )}
            
            {!destination && !isCalculating && (
               <div className="absolute inset-0 bg-brand-black/60 flex items-center justify-center backdrop-blur-[4px] pointer-events-none z-10 flex-col text-gray-400">
                  <MapPin className="w-10 h-10 mb-3 opacity-50" />
                  <span className="text-sm font-medium">Mapa se zobrazí po zadání adresy</span>
               </div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-xs text-gray-500 italic text-center">
          * Odhadovaná cena zahrnuje výjezd z naší základny a základní práci. Může se mírně lišit dle typu zámku. Pro přesnou cenu volejte.
        </p>
      </div>
    </div>
  );
};

export default function App() {
  if (!hasValidKey) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif',backgroundColor:'#050505',color:'#fff'}}>
        <div style={{textAlign:'center',maxWidth:520,padding:'2rem'}}>
          <h2 style={{color:'#FF6B00'}}>Google Maps API Key Required</h2>
          <p><strong>Step 1:</strong> <a style={{color:'#4285F4'}} href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener">Get an API Key</a></p>
          <p><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
          <ul style={{textAlign:'left',lineHeight:'1.8',padding:'1rem',backgroundColor:'#121212',borderRadius:'8px',marginBottom:'1rem'}}>
            <li>Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, press <strong>Enter</strong></li>
            <li>Paste your API key as the value, press <strong>Enter</strong></li>
          </ul>
          <p>The app rebuilds automatically after you add the secret.</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="min-h-screen flex flex-col font-sans text-white overflow-x-hidden selection:bg-brand-orange selection:text-white">
      {/* Navigation */}
      <nav className="absolute top-0 w-full p-6 sm:p-8 z-50 flex justify-between items-center">
        <a href="/" className="inline-flex items-center gap-3 sm:gap-4 group">
          <img 
            src="/logo.png" 
            alt="FastLock Logo" 
            className="h-16 sm:h-20 w-auto object-contain transition-transform group-hover:scale-105" 
          />
          <span className="text-3xl sm:text-4xl font-heading font-black italic tracking-tighter text-brand-orange">
            FASTLOCK
          </span>
        </a>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-4 pt-20 pb-12">
        {/* Abstract Background Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-heading font-black italic uppercase tracking-tighter leading-[1.1] sm:leading-[1.1] flex flex-col items-center">
            <div className="flex flex-wrap justify-center items-end gap-x-2 sm:gap-x-4">
              <span>Zabouchnuté</span>
              <div className="flex items-end">
                <SlotMachine />
                <span className="ml-1 sm:ml-2">?</span>
              </div>
            </div>
            <div className="mt-2 sm:mt-4">
              Vyřešíme to <span className="text-brand-orange drop-shadow-[0_0_15px_rgba(255,107,0,0.5)]">FAST</span>.
            </div>
          </h1>

          <p className="mt-8 text-lg sm:text-2xl font-medium text-gray-400 flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
            <span className="flex items-center gap-2">
              <MapPin className="text-brand-orange w-5 h-5 sm:w-6 sm:h-6" /> Praha a okolí
            </span>
            <span className="hidden sm:inline text-brand-lightgray text-3xl">|</span>
            <span className="flex items-center gap-2 text-white">
              <Clock className="text-brand-orange w-5 h-5 sm:w-6 sm:h-6" /> U Vás do 60 minut
            </span>
          </p>

          <div className="mt-12 sm:mt-16 relative">
            <div className="absolute inset-0 bg-brand-orange blur-[40px] opacity-40 rounded-full animate-pulse"></div>
            <a
              href="tel:+420773215885"
              className="group relative inline-flex items-center justify-center gap-4 sm:gap-5 bg-brand-orange text-white text-2xl sm:text-4xl font-heading font-black italic px-8 py-5 sm:px-12 sm:py-7 uppercase tracking-wider overflow-hidden hover:scale-105 transition-transform duration-300 rounded-sm"
            >
              <div className="absolute inset-0 w-full h-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <PhoneCall className="w-8 h-8 sm:w-10 sm:h-10 animate-[pulse_1.5s_ease-in-out_infinite]" />
              <span className="relative z-10">Zavolat Hned</span>
            </a>
          </div>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-24 bg-brand-gray px-4 relative border-t border-brand-lightgray">
        <div className="max-w-5xl mx-auto">
          <Calculator />
        </div>
      </section>

      {/* Footer / About Section */}
      <section className="py-24 bg-brand-black px-4 relative border-t border-brand-lightgray">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          <ShieldCheck className="w-16 h-16 text-brand-orange mb-6" />
          <h2 className="text-3xl sm:text-4xl font-heading font-black italic uppercase tracking-tighter mb-6">
            Specializované práce a trezory
          </h2>
          <p className="text-lg text-gray-400 font-medium leading-relaxed max-w-2xl mb-12">
            FastLock je přímou odnoží zavedené značky, díky čemuž stojíme na pevných základech a čerpáme z letitých zkušeností samotného mistra oboru, který ji vlastní. V případě extrémně složitých prací, jako je otevírání trezorů nebo nouzové otevírání automobilů od roku výroby 2014 a novějších, volejte přímo na <a href="https://www.oteviranidveri.cz/" target="_blank" className="text-orange-500 font-black italic underline hover:text-orange-400 transition-colors">BOBLOCK</a>.
          </p>

          <div className="flex flex-col sm:flex-row gap-8 sm:gap-16 items-center justify-center w-full pt-12 border-t border-brand-lightgray">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                Zákaznická Linka
              </span>
              <a
                href="tel:+420773215885"
                className="text-2xl font-heading font-black italic hover:text-brand-orange transition-colors"
              >
                +420 773 215 885
              </a>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                Základna
              </span>
              <span className="text-xl font-medium text-gray-300">
                Praha - V Jezírkách
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
    </APIProvider>
  );
}
