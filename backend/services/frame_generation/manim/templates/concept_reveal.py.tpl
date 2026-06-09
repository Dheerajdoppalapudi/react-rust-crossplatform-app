from manim import *
{VOICEOVER_IMPORTS}

class GeneratedScene(VoiceoverScene):
    def construct(self):
        {SPEECH_SERVICE_INIT}
        self.camera.background_color = "#0f1117"

        ACCENT = {ACCENT_COLOR}

        # Heading + underline
        heading = Text("{HEADING}", font_size=42, color=ACCENT, weight=BOLD)
        heading.to_edge(UP, buff=0.6)
        underline = Line(
            start=heading.get_left() + DOWN * 0.08,
            end=heading.get_right() + DOWN * 0.08,
            color=ACCENT, stroke_width=3,
        )
        underline.next_to(heading, DOWN, buff=0.1)

        # Bullets
        bullet_texts = ["{BULLET_0}", "{BULLET_1}", "{BULLET_2}"]
        bullets = VGroup(*[
            Text("•  " + t, font_size=30, color=WHITE)
            for t in bullet_texts if t
        ]).arrange(DOWN, aligned_edge=LEFT, buff=0.5)
        bullets.move_to(DOWN * 0.3)

        # Narrated reveal — animation paced to the spoken duration.
        with self.voiceover(text="{NARRATION}") as tracker:
            self.play(Write(heading), run_time=min(1.0, tracker.duration * 0.25))
            self.play(Create(underline), run_time=min(0.5, tracker.duration * 0.1))
            if len(bullets) > 0:
                self.play(
                    LaggedStart(*[FadeIn(b, shift=RIGHT * 0.3) for b in bullets], lag_ratio=0.4),
                    run_time=max(0.6, tracker.duration * 0.6),
                )

        # Keyword strip (brief, after narration)
        kw_texts = [{KEYWORD_LIST}]
        if kw_texts:
            kws = [Text(w, font_size=22, color=GOLD) for w in kw_texts]
            kw_group = VGroup(*kws).arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.4)
            self.play(LaggedStart(*[FadeIn(t) for t in kws], lag_ratio=0.2), run_time=0.6)
            self.wait(0.5)
