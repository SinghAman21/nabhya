% final_raitdisser.cls
% B.Tech project report class, Vidyalankar Institute of Technology.
% Based on the IITB APS class by Amey Karkare (Perl Artistic License).
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{final_raitdisser}[2026/01/01 B.Tech Project Report VIT]

\DeclareOption*{\PassOptionsToClass{\CurrentOption}{report}}
\ProcessOptions
\PassOptionsToClass{12pt,a4paper}{report}
\LoadClass{report}

% ---------------- Supervisor / co-supervisor ----------------
\def\@advisorname{None}
\newcommand{\setguide}[1]{\def\@advisorname{#1}}
\global\let\@coadvisorname\@empty
\newcommand{\setcoguide}[1]{\def\@coadvisorname{#1}}
\let\coguide\setcoguide

% ---------------- Title page ----------------
\newcommand\@thesistitlesmlskip{0.15in}
\newcommand\@thesistitlemedskip{0.35in}
\newcommand\@thesistitlebigskip{0.75in}

\newcommand{\department}[1]{\gdef\@department{#1}}
\newcommand{\reporttype}[1]{\gdef\@doctype{#1}}

\gdef\@doctype{Submitted in fulfilment of the requirements \\ \vspace{0.15in} For the degree of\\ \vspace{0.2in}\large \bf B.Tech. \vspace{0.2in}\\
Department of Information Technology}
\gdef\@department{(Unknown Department)}

\renewcommand{\maketitle}{\begin{titlepage}
    \def\thanks##1{\typeout{Warning: `thanks' deleted from title page.}}
    \let\footnotesize\small \let\footnoterule\relax \setcounter{page}{1}
    \vspace*{0.1in}
    \begin{center}
      \mbox{}\\
      {\bf\expandafter\uppercase\expandafter{\LARGE\@title}} \\[\@thesistitlebigskip]
      {\large  \@doctype} \\[\@thesistitlesmlskip]
      {\large by} \\[\@thesistitlesmlskip]
      {\large \bf \@author} \\ [\@thesistitlesmlskip]
      \vspace{0.4in}{\large Supervisor }  \\[\@thesistitlesmlskip]
      {\large \bf \@advisorname} \\[\@thesistitlesmlskip]
      \ifx\@coadvisorname\@empty
        \mbox{}\\[\@thesistitlemedskip]
      \else
        {\large and } \\[\@thesistitlesmlskip]
        {\large \bf \@coadvisorname} \\\vspace{0.1in}
      \fi
      \IfFileExists{VIT.png}{\origincludegraphics[width=10cm]{VIT.png}}{%
        \IfFileExists{images/VIT.png}{\origincludegraphics[width=10cm]{images/VIT.png}}{%
          \fbox{\parbox[c][1.0cm][c]{8cm}{\centering Insert VIT logo here}}}}\\[\@thesistitlesmlskip]
      {\large \MakeUppercase{\@department}} \\
      {\large Vidyalankar Institute of Technology,\\Wadala, Mumbai - 400037.\\(Under the ambit of University of Mumbai)}\\
    \end{center}
  \end{titlepage}
  \setcounter{footnote}{0}
  \setcounter{page}{1}
}

% ---------------- Abstract ----------------
\def\abstract{
  \chapter*{Abstract}
  \addcontentsline{toc}{chapter}{Abstract}
  \relax\markboth{ABSTRACT}{ABSTRACT}}
\def\endabstract{\par\newpage}

% ---------------- List of figures / tables (with ToC entries) ----------------
\renewcommand\listoffigures{%
    \if@twocolumn
      \@restonecoltrue\onecolumn
    \else
      \@restonecolfalse
    \fi
    \chapter*{\listfigurename}%
    \addcontentsline{toc}{chapter}{\listfigurename}%
      \@mkboth{\MakeUppercase\listfigurename}%
              {\MakeUppercase\listfigurename}%
    \@starttoc{lof}%
    \if@restonecol\twocolumn\fi
    }
\renewcommand\listoftables{%
    \if@twocolumn
      \@restonecoltrue\onecolumn
    \else
      \@restonecolfalse
    \fi
    \chapter*{\listtablename}%
    \addcontentsline{toc}{chapter}{\listtablename}%
      \@mkboth{%
          \MakeUppercase\listtablename}%
         {\MakeUppercase\listtablename}%
    \@starttoc{lot}%
    \if@restonecol\twocolumn\fi
    }

% ---------------- Spacing switches ----------------
\newcommand{\oneskip}{1.0}
\newcommand{\twoskip}{1.5}
\newcommand{\singlespace}
  {\renewcommand{\baselinestretch}{\oneskip}\Large\normalsize}
\newcommand{\doublespace}
  {\renewcommand{\baselinestretch}{\twoskip}\Large\normalsize}

% ---------------- Page geometry ----------------
\setlength{\textheight}{245mm}
\setlength{\textwidth}{160mm}
\setlength{\headheight}{3mm}
\setlength{\headsep}{12mm}
\setlength{\topmargin}{15mm}
\if@twoside
  \setlength{\oddsidemargin}{30mm}
  \setlength{\evensidemargin}{20mm}
\else
  \setlength{\oddsidemargin}{30mm}
  \setlength{\evensidemargin}{30mm}
\fi
\setlength{\hoffset}{-1in}
\setlength{\voffset}{-1in}
\setlength{\parindent}{5ex}
\singlespace
