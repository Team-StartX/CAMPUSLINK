'use client';

import Image from 'next/image';
import { useRef, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y, EffectCreative, Keyboard } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';

const members = [
  { name: 'Diptiprava Dash', role: 'Team leader', image: 'diptiprava' },
  { name: 'Sonalika Nayak', role: 'Presenter', image: 'sonalika' },
  { name: 'Ayushman Nayak', role: 'Tester', image: 'ayushman' },
  { name: 'Rishikanta Sahoo', role: 'AI engineer', image: 'rishikanta' },
  { name: 'Sachin Das', role: 'AI engineer', image: 'sachin' },
  { name: 'Biswojit Sahoo', role: 'Developer & UI/UX', image: 'biswojit' },
];
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function TeamCard({
  member,
  standalone = false,
}: {
  member: (typeof members)[number];
  standalone?: boolean;
}) {
  return (
    <Image
      className={standalone ? 'startx-swiper startx-card' : 'startx-card'}
      src={`/images/team-startx/${member.image}${member.image === 'biswojit' ? '' : '-transparent'}.png`}
      alt={`${member.name}, ${member.role}, Team StartX`}
      width={1024}
      height={1536}
      sizes="(max-width: 600px) 280px, 340px"
      draggable={false}
    />
  );
}

export function TeamStartX() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const reduced = useHydratedReducedMotion();

  const slider = useRef<SwiperInstance | null>(null);
  return (
    <section className="startx-section" id="team-startx" aria-labelledby="startx-title">
      <h2 id="startx-title">
        Meet The Developers Of <span>Team StartX</span>
      </h2>
      {hydrated ? (
        <Swiper
          className="startx-swiper"
          modules={[A11y, EffectCreative, Keyboard]}
          rewind
          onSwiper={(instance) => {
            slider.current = instance;
          }}
          slidesPerView={1}
          effect="creative"
          speed={reduced ? 0 : 550}
          creativeEffect={{
            prev: { translate: ['-115%', 0, -180], rotate: [0, 0, -8], opacity: 0 },
            next: { translate: ['115%', 0, -180], rotate: [0, 0, 8], opacity: 0 },
          }}
          keyboard={{ enabled: true, onlyInViewport: true }}
          a11y={{
            containerMessage: 'Team StartX members',
            itemRoleDescriptionMessage: 'team card',
          }}
        >
          {members.map((person) => (
            <SwiperSlide key={person.image}>
              <TeamCard member={person} />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <TeamCard member={members[0]} standalone />
      )}
      <div className="startx-arrows">
        <button
          type="button"
          aria-label="Previous team member"
          disabled={!hydrated}
          onClick={() => slider.current?.slidePrev()}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          type="button"
          aria-label="Next team member"
          disabled={!hydrated}
          onClick={() => slider.current?.slideNext()}
        >
          <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}
