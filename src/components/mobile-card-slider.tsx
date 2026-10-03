'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';

import { Children, type ReactNode, useSyncExternalStore } from 'react';
import { A11y, Keyboard, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

const query = '(max-width: 700px)';
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const getMobile = () => window.matchMedia(query).matches;
const getServerMobile = () => false;

export function MobileCardSlider({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label: string;
}) {
  const mobile = useSyncExternalStore(subscribe, getMobile, getServerMobile);
  const reducedMotion = useHydratedReducedMotion();

  if (!mobile) return <div className={className}>{children}</div>;

  return (
    <Swiper
      className={`${className} mobile-card-slider`}
      modules={[A11y, Keyboard, Pagination]}
      slidesPerView={1.08}
      spaceBetween={16}
      speed={reducedMotion ? 0 : 350}
      pagination={{ clickable: true }}
      keyboard={{ enabled: true, onlyInViewport: true }}
      a11y={{ containerMessage: label, itemRoleDescriptionMessage: 'card' }}
    >
      {Children.toArray(children).map((card, index) => (
        <SwiperSlide key={index}>{card}</SwiperSlide>
      ))}
    </Swiper>
  );
}
