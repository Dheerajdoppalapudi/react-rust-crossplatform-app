from manim import *
{VOICEOVER_IMPORTS}

class GeneratedScene(VoiceoverScene):
    def construct(self):
        {SPEECH_SERVICE_INIT}
        self.camera.background_color = "#0f1117"

        # Vertical divider + titles
        divider = Line(start=UP * 3.3, end=DOWN * 3.2, color=GRAY, stroke_width=1.5)
        left_title = Text("{LEFT_TITLE}", font_size=32, color=BLUE, weight=BOLD)
        left_title.move_to(LEFT * 3.4 + UP * 2.9)
        right_title = Text("{RIGHT_TITLE}", font_size=32, color=ORANGE, weight=BOLD)
        right_title.move_to(RIGHT * 3.4 + UP * 2.9)

        # Points
        left_points = [{LEFT_POINTS}]
        right_points = [{RIGHT_POINTS}]
        left_items = [Text("•  " + p, font_size=24, color=WHITE) for p in left_points]
        right_items = [Text("•  " + p, font_size=24, color=WHITE) for p in right_points]
        if left_items:
            VGroup(*left_items).arrange(DOWN, aligned_edge=LEFT, buff=0.4).next_to(left_title, DOWN, buff=0.5)
        if right_items:
            VGroup(*right_items).arrange(DOWN, aligned_edge=LEFT, buff=0.4).next_to(right_title, DOWN, buff=0.5)

        # Narrated reveal — animation paced to the spoken duration.
        with self.voiceover(text="{NARRATION}") as tracker:
            self.play(
                Create(divider), Write(left_title), Write(right_title),
                run_time=min(1.2, tracker.duration * 0.25),
            )
            reveal = []
            for i in range(max(len(left_items), len(right_items))):
                if i < len(left_items):
                    reveal.append(FadeIn(left_items[i], shift=RIGHT * 0.2))
                if i < len(right_items):
                    reveal.append(FadeIn(right_items[i], shift=LEFT * 0.2))
            if reveal:
                self.play(LaggedStart(*reveal, lag_ratio=0.3),
                          run_time=max(0.6, tracker.duration * 0.7))

        # Optional conclusion + keyword strip (brief, after narration)
        conclusion_text = "{CONCLUSION}"
        if conclusion_text:
            conclusion = Text(conclusion_text, font_size=26, color=GOLD).to_edge(DOWN, buff=0.95)
            self.play(FadeIn(conclusion), run_time=0.6)

        kw_texts = [{KEYWORD_LIST}]
        if kw_texts:
            kws = [Text(w, font_size=22, color=GOLD) for w in kw_texts]
            kw_group = VGroup(*kws).arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.4)
            self.play(LaggedStart(*[FadeIn(t) for t in kws], lag_ratio=0.2), run_time=0.6)
        self.wait(0.5)
