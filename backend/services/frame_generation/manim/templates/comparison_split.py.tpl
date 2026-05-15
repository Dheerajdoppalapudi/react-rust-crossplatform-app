from manim import *

class GeneratedScene(Scene):
    def construct(self):
        self.camera.background_color = "#1e1e2e"

        # Vertical divider
        divider = Line(start=UP * 3.5, end=DOWN * 3.2, color=GRAY, stroke_width=1.5)
        self.play(Create(divider), run_time=0.4)

        # Left title
        left_title = Text("{LEFT_TITLE}", font_size=30, color=BLUE, weight=BOLD)
        left_title.move_to(LEFT * 3.2 + UP * 3.0)
        # Right title
        right_title = Text("{RIGHT_TITLE}", font_size=30, color=ORANGE, weight=BOLD)
        right_title.move_to(RIGHT * 3.2 + UP * 3.0)

        self.play(Write(left_title), Write(right_title), run_time=0.6)
        self.wait(0.2)

        # Points — alternate left/right
        left_points = [{LEFT_POINTS}]
        right_points = [{RIGHT_POINTS}]

        left_items = [Text("• " + p, font_size=24, color=WHITE) for p in left_points]
        right_items = [Text("• " + p, font_size=24, color=WHITE) for p in right_points]

        left_group = VGroup(*left_items).arrange(DOWN, aligned_edge=LEFT, buff=0.35)
        left_group.next_to(left_title, DOWN, buff=0.4)
        left_group.align_to(LEFT * 0.4, RIGHT)

        right_group = VGroup(*right_items).arrange(DOWN, aligned_edge=LEFT, buff=0.35)
        right_group.next_to(right_title, DOWN, buff=0.4)
        right_group.align_to(RIGHT * 0.4, LEFT)

        max_pts = max(len(left_items), len(right_items))
        for i in range(max_pts):
            anims = []
            if i < len(left_items):
                anims.append(FadeIn(left_items[i], shift=RIGHT * 0.2))
            if i < len(right_items):
                anims.append(FadeIn(right_items[i], shift=LEFT * 0.2))
            if anims:
                self.play(*anims, run_time=0.4)
                self.wait(0.2)

        # Optional conclusion
        conclusion_text = "{CONCLUSION}"
        if conclusion_text:
            conclusion = Text(conclusion_text, font_size=24, color=GOLD)
            conclusion.to_edge(DOWN, buff=0.55)
            self.play(FadeIn(conclusion), run_time=0.5)

        self.wait(1.0)

        # Keyword strip
        kw_texts = [{KEYWORD_LIST}]
        if kw_texts:
            kws = [Text(w, font_size=22, color=GOLD) for w in kw_texts]
            kw_group = VGroup(*kws).arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.35)
            self.play(LaggedStart(*[FadeIn(t) for t in kws], lag_ratio=0.2), run_time=0.6)
        self.wait(0.8)
