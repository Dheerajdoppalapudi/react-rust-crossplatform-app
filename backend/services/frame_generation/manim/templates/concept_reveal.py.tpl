from manim import *

class GeneratedScene(Scene):
    def construct(self):
        self.camera.background_color = "#1e1e2e"

        ACCENT = {ACCENT_COLOR}

        # Heading
        heading = Text("{HEADING}", font_size=38, color=ACCENT, weight=BOLD)
        heading.to_edge(UP, buff=0.55)
        underline = Line(
            start=heading.get_left() + DOWN * 0.08,
            end=heading.get_right() + DOWN * 0.08,
            color=ACCENT, stroke_width=2,
        )
        underline.next_to(heading, DOWN, buff=0.08)
        self.play(Write(heading), run_time=0.7)
        self.play(Create(underline), run_time=0.4)
        self.wait(0.2)

        # Bullets
        bullet_texts = [
            "{BULLET_0}",
            "{BULLET_1}",
            "{BULLET_2}",
        ]
        bullets = VGroup(*[
            Text("• " + t, font_size=28, color=WHITE)
            for t in bullet_texts
        ]).arrange(DOWN, aligned_edge=LEFT, buff=0.45)
        bullets.move_to(ORIGIN + DOWN * 0.3)

        for b in bullets:
            self.play(FadeIn(b, shift=RIGHT * 0.3), run_time=0.45)
            self.wait(0.25)

        self.wait(0.4)

        # Keyword strip
        kw_texts = [{KEYWORD_LIST}]
        if kw_texts:
            kws = [Text(w, font_size=22, color=GOLD) for w in kw_texts]
            kw_group = VGroup(*kws).arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.35)
            self.play(LaggedStart(*[FadeIn(t) for t in kws], lag_ratio=0.2), run_time=0.6)
        self.wait(1.0)
