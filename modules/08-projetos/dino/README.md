# Dino RL — Laboratório Prático de Aprendizado por Reforço

Este projeto foi desenvolvido como material didático e experimental para o estudo dos fundamentos do **Aprendizado por Reforço Profundo (Deep Q-Learning / DQN)**. 

O repositório integra uma simulação do clássico jogo do dinossauro (executada em JavaScript no navegador) a um agente inteligente implementado em Python utilizando puramente NumPy, permitindo a análise direta de cada etapa do treinamento e da inferência.

---

## A Ideia Central para o Aluno

Em **Aprendizado Supervisionado**, o treinamento parte de pares de entrada e saída $(X, y)$, onde $y$ representa o rótulo verdadeiro ou o alvo conhecido a priori. A rede calcula o erro em relação a esse alvo e ajusta seus parâmetros via gradiente descendente.

No **Aprendizado por Reforço (RL)**:
> **A rede neural continua sendo otimizada por gradiente descendente e retropropagação (*backpropagation*) convencional.**  
> **A diferença fundamental reside na origem do alvo:** o alvo não é fornecido externamente, mas sim estimado pelo próprio agente por meio da **Equação de Bellman**:
>
> $$\text{alvo} = \text{recompensa} + \gamma \cdot \max_{a'} Q(s', a')$$

Neste projeto:
- A rede neural foi implementada do zero em NumPy, sem dependência de bibliotecas de alto nível (como PyTorch ou TensorFlow), permitindo inspecionar diretamente as matrizes de pesos, as operações lineares, as ativações e o cálculo analítico dos gradientes.
- O ambiente executa **20 pistas paralelas simultâneas** no navegador, todas compartilhando o mesmo modelo de decisão para otimizar a taxa de amostragem temporal.
- É possível intercalar o controle do agente com intervenções manuais (*Human-in-the-loop*), alimentando o buffer de repetição com demonstrações humanas para estudo de inicialização de políticas.

---

## Guia Passo a Passo: Execução do Projeto

### 1. Pré-requisitos

- **Python 3.8+**
- *(Opcional)* **Node.js** para execução de testes unitários do motor físico e baterias de avaliação automatizada via terminal.

### 2. Preparação do Ambiente

No diretório `aula01`:

```bash
cd aula01

# Criação do ambiente virtual
python3 -m venv .venv

# Ativação do ambiente:
# Linux / macOS:
source .venv/bin/activate
# Windows:
# .venv\Scripts\activate

# Instalação das dependências
pip install -r requirements.txt
```

### 3. Inicialização dos Serviços

O sistema depende de dois processos executados simultaneamente:

#### Terminal 1 — Servidor de Decisão e Treinamento (Python WebSocket)
Responsável pelo modelo neural, memória de experiências (*replay buffer*) e aplicação das atualizações de Bellman:
```bash
python -m agente.servidor
```
*O serviço escuta por conexões WebSocket na porta local `ws://localhost:8765`.*

#### Terminal 2 — Servidor da Aplicação Web (HTTP)
Responsável por servir os arquivos estáticos e a lógica de renderização e física:
```bash
python servir.py
```
*Nota técnica:* O utilitário `servir.py` foi configurado especificamente para injetar cabeçalhos de desativação de cache (`Cache-Control: no-store`). Isso assegura que edições nos arquivos JavaScript sejam refletidas imediatamente ao recarregar a página, sem interferência de cache local do navegador.

### 4. Operação da Interface Web

Acesse no navegador:
**[http://localhost:8000/jogo/index.html](http://localhost:8000/jogo/index.html)**

A interface apresenta 20 pistas simultâneas e um painel de controle com três modos operacionais:

| Modo | Controle | Registro no Replay Buffer | Atualização dos Pesos | Finalidade Didática |
|---|---|---|---|---|
| **Humano** | Teclado | Sim (com servidor ativo) | Não | Coleta de dados supervisionados por demonstração |
| **Treinar** | Agente ($\epsilon$-greedy) | Sim (limite circular de 50.000) | Sim (a cada lote amostrado) | Aprendizado autônomo com exploração ativa |
| **Assistir** | Agente (Greedy puro) | Não | Não | Avaliação qualitativa do comportamento aprendido |

#### Comandos de Entrada:
- **Controle Manual (Modo Humano):**
  - `Seta Cima` ou `Barra de Espaço`: Pular
  - `Seta Baixo`: Abaixar
  - `Seta Esquerda` / `Seta Direita`: Alternar o foco de controle entre as 20 pistas.
- **Modo Turbo:** Acelera o passo de tempo da simulação no motor JavaScript, permitindo acumular milhares de transições em poucos minutos.
- **Painel Superior (HUD):** Exibe as estimativas dos valores Q em tempo real para cada ação, os pesos sinápticos atuais, o parâmetro de exploração ($\epsilon$), a função de perda e a contagem de transições armazenadas.

### 5. Comandos Auxiliares de Treinamento e Avaliação

#### Retomada de Sessão Anterior:
```bash
python -m agente.servidor --continuar
```

#### Execução Exclusiva para Demonstração:
```bash
python -m agente.servidor --continuar --assistir
```

#### Geração de Gráficos de Treinamento:
Gera a curva de convergência, função de perda e decaimento do fator de exploração:
```bash
python -m agente.graficos
```
*Gera o arquivo `modelos/curvas.png` a partir dos dados consolidados em `modelos/treino_6entradas.csv`.*

#### Avaliação Formal Headless (requer Node.js):
Executa baterias estatísticas sem interface gráfica para aferir a recompensa acumulada média e mediana:
```bash
python -m agente.avaliar --modelo modelos/treino_6entradas.npz --partidas 50
```

#### Execução da Suíte de Testes Automatizados:
```bash
pytest -q
```

---

## Roteiro Metodológico para Estudo do Código-Fonte

Recomenda-se a exploração dos módulos na ordem estruturada abaixo, progredindo da álgebra linear elementar à integração de sistemas concorrentes:

```
aula01/
├── agente/
│   ├── rede.py         <-- 1. Rede neural em NumPy e diferenciação analítica
│   ├── memoria.py      <-- 2. Buffer circular de repetição de experiências
│   ├── agente.py       <-- 3. Algoritmo DQN, Bellman e Target Network
│   ├── servidor.py     <-- 4. Protocolo de comunicação assíncrono via WebSocket
│   └── testes/         <-- 5. Testes unitários e validação por diferenças finitas
└── jogo/
    ├── motor.js        <-- 6. Modelagem física, estados e regras de transição
    └── painel.js       <-- 7. Visualização instrumental das ativações neurais
```

---

### Análise Conceitual e Correspondência no Código

### 1. Camada Neural em NumPy ([`agente/rede.py`](agente/rede.py))
Implementação explícita de um Perceptron Multicamadas (MLP) com topologia $6 \to 8 \to 3$:
- **Camada Oculta:** 8 unidades com função de ativação linear retificada (ReLU: $\max(0, z)$).
- **Camada de Saída:** 3 unidades com ativação puramente linear.
  > **Aspecto Teórico:** Em tarefas de classificação, a camada final tipicamente emprega Softmax para obter uma distribuição de probabilidade sobre classes. Em Q-Learning, a saída representa a função valor de ação $Q(s, a) \in \mathbb{R}$, isto é, o retorno acumulado esperado descontado. Por essa razão, a camada final deve ser linear.
- **Cálculo Analítico de Gradientes:** O método `gradientes(X, alvos)` deriva analiticamente a perda quadrática média (MSE) em relação aos pesos $W_1, W_2$ e vieses $b_1, b_2$ via regra da cadeia. A conformidade dessa derivação é verificada numericamente em [`agente/testes/test_rede.py`](agente/testes/test_rede.py) por meio de perturbação finita bilateral:
  $$\frac{\partial L}{\partial w} \approx \frac{L(w + \epsilon) - L(w - \epsilon)}{2\epsilon}$$

---

### 2. Buffer de Repetição de Experiências ([`agente/memoria.py`](agente/memoria.py))
Armazena transições na forma de tuplas $(s_t, a_t, r_t, s_{t+1}, \text{terminal})$.
- **Problema da Correlação Temporal:** Em simulações contínuas, quadros sucessivos apresentam forte dependência estatística. A atualização sequencial direta viola a hipótese de amostras independentes e identicamente distribuídas (IID), provocando divergência ou oscilação degenerativa nos gradientes.
- **Amostragem Aleatória:** Ao sortear minilotes uniformemente a partir de um histórico de 50.000 amostras, o algoritmo quebra a autocorrelação temporal e estabiliza a convergência numérica.

---

### 3. Algoritmo Q-Learning e Estratégia de Decisão ([`agente/agente.py`](agente/agente.py))

#### A. Otimização de Bellman e Definição dos Alvos (`_alvos`)
```python
alvos = self.rede.prever(estados).copy()
melhor_futuro = self.rede_alvo.prever(proximos).max(axis=1)
melhor_futuro = np.where(terminais, 0.0, melhor_futuro)

# Atualização de Bellman aplicada estritamente à ação tomada
alvos[np.arange(len(acoes)), acoes] = recompensas + self.gama * melhor_futuro
```
- **Preservação de Alvos Neutros:** A matriz de alvos é inicializada com as predições atuais da própria rede. Consequentemente, para qualquer ação $a \neq a_t$, o resíduo $(z_2 - \text{alvo})$ é identicamente nulo, restringindo o gradiente estritamente à dimensão da ação executada.
- **Condição Terminal:** Quando `terminal = True`, o horizonte temporal encerra-se ($s_{t+1}$ não possui valor residual futuro). O valor alvo colapsa unicamente para a recompensa imediata: $\text{alvo} = r_t$.

#### B. Estabilização por Rede-Alvo (*Target Network*)
O treinamento de DQN envolve um problema inerente de "alvo móvel" (*moving target problem*): se os mesmos pesos parametrizassem simultaneamente a avaliação do estado atual e a projeção do estado futuro, cada atualização modificaria os próprios valores de referência. Para mitigar esse acoplamento, mantém-se uma rede secundária (`self.rede_alvo`) congelada, cujos parâmetros são sincronizados periodicamente (a cada 500 iterações).

#### C. Política de Exploração $\epsilon$-Greedy
- Com probabilidade $\epsilon$, seleciona-se uma ação aleatória uniforme do espaço de ações discretas.
- Com probabilidade $1 - \epsilon$, opta-se pela ação com maior valor estimado: $\arg\max_a Q(s, a)$.
- O valor de $\epsilon$ sofre decaimento linear em função do total de transições coletadas no ambiente, assegurando ampla exploração inicial e convergência para explotação na fase final.

---

### 4. Modelagem do Ambiente e Vetor de Observação ([`jogo/motor.js`](jogo/motor.js))

Em vez de operar sobre matrizes de pixels com redes convolucionais, o estado do ambiente é simplificado em um vetor compacto de **6 variáveis contínuas normalizadas**:

| Variável | Significado Físico | Fator de Escala | Relevância para a Decisão |
|---|---|---|---|
| **$x_1$** | Distância horizontal até o obstáculo | $\text{distância} / 800$ | Proximidade temporal do impacto |
| **$x_2$** | Largura do obstáculo | $\text{largura} / 46$ | Diferenciação entre obstáculos unitários e agrupados |
| **$x_3$** | Cota inferior do obstáculo | $\text{altura\_base} / 100$ | Identificação do tipo de obstáculo (terrestre vs. aéreo) |
| **$x_4$** | Velocidade horizontal global | $\text{velocidade} / 11$ | Ajuste da janela de tempo útil de reação |
| **$x_5$** | Posição vertical do agente | $y_{\text{dino}} / 100$ | Indicação de contato com o solo ou elevação |
| **$x_6$** | Velocidade vertical do agente | $v_y / 10$ | Discriminação de trajetória ascendente ($>0$) ou descendente ($<0$) |

> **Fundamentação Markoviana:** Sem a inclusão de $x_5$ e $x_6$, o sistema caracterizaria um Processo de Decisão Parcialmente Observável (POMDP), pois um agente no ápice de um salto e um agente em repouso no solo poderiam registrar idênticas observações do mundo exterior, embora respondam de formas completamente distintas ao comando de salto.

#### Espaço Discreto de Ações:
- `0`: Manter deslocamento padrão (Correr)
- `1`: Aplicar impulso vertical (Pular)
- `2`: Reduzir perfil vertical (Abaixar)

#### Função de Recompensa:
- **+0.1** por quadro de sobrevivência (incentivo à longevidade).
- **-10.0** em caso de colisão (penalização severa de falha).

---

## Generalização da Arquitetura para Outros Domínios

A estrutura composta por [`agente/rede.py`](agente/rede.py), [`agente/memoria.py`](agente/memoria.py) e [`agente/agente.py`](agente/agente.py) constitui um núcleo modular desacoplado da mecânica do jogo, sendo diretamente aplicável a outros problemas formulados como MDPs com espaço de ação discreto.

### Roteiro de Adaptação

1. **Definição do Espaço de Estados:** Mapear as variáveis contínuas relevantes do sistema em um vetor unidimensional de dimensão fixa $D$, normalizando suas componentes para intervalos de magnitude homogênea (preferencialmente em $[0, 1]$ ou $[-1, 1]$).
2. **Definição do Espaço de Ações:** Enumerar as decisões discretas disponíveis como inteiros em $\{0, 1, \dots, K-1\}$.
3. **Formulação da Função de Recompensa:** Balancear penalidades de término indesejado e recompensas progressivas de desempenho para evitar comportamentos oportunistas espúrios (*reward hacking*).

### Exemplo de Integração com a API Gymnasium (CartPole-v1)

```python
import gymnasium as gym
from agente.agente import Agente

# 1. Instanciação do ambiente padronizado
env = gym.make("CartPole-v1")

# 2. Inicialização do agente
# Para o CartPole: 4 entradas de estado contínuo e 2 ações discretas
agente = Agente(
    gama=0.99,
    taxa=0.001,
    epsilon_inicial=1.0,
    epsilon_final=0.01,
    transicoes_decaimento=40000,
    capacidade=20000,
    lote=64
)

# 3. Ciclo de interação Agente-Ambiente
for episodio in range(300):
    estado, _ = env.reset()
    terminou = False
    retorno_acumulado = 0.0

    while not terminou:
        # Seleção de ação com política epsilon-greedy
        acao = agente.escolher([estado])[0]
        
        # Transição de estado no ambiente
        proximo_estado, recompensa, finalizado, truncado, _ = env.step(acao)
        terminou = finalizado or truncado

        # Registro no buffer e atualização de gradiente
        agente.lembrar(estado, acao, recompensa, proximo_estado, terminou)
        agente.treinar_um_passo()

        estado = proximo_estado
        retorno_acumulado += recompensa

    print(f"Episódio {episodio:03d} | Retorno: {retorno_acumulado:6.1f} | Epsilon: {agente.epsilon:.3f}")
```

---

## Propostas de Exercícios e Hipóteses Experimentais

Para consolidar os conceitos abordados, sugere-se a condução dos seguintes experimentos quantitativos:

1. **Influência de Dados de Demonstração Humana:**
   - Execute o sistema no modo **Humano** coletando 1.500 transições antes de iniciar o processo autônomo.
   - Compare a curva de aprendizado inicial em relação a uma execução treinada estritamente com inicialização aleatória dos pesos.
2. **Avaliação da Degradação sem Target Network:**
   - No arquivo [`agente/agente.py`](agente/agente.py), substitua a referência de predição futura para a própria rede de treino (`self.rede_alvo = self.rede`).
   - Registre a instabilidade da função de perda e a taxa de falha na estabilização dos valores Q.
3. **Sensibilidade do Fator de Desconto ($\gamma$):**
   - Avalie o comportamento do agente com $\gamma = 0.50$ versus $\gamma = 0.99$. Analise como a miopia temporal afeta a capacidade do dinossauro de antecipar saltos em velocidades progressivas.
4. **Verificação Numérica de Gradientes:**
   - Inspecione a implementação do teste de gradientes em [`agente/testes/test_rede.py`](agente/testes/test_rede.py) e confirme a convergência matemática do algoritmo executando `pytest agente/testes/test_rede.py -v`.

---

## Autoria

**Autor:** Pablo Chiaro Rosa  
**Contato:** pablo.chiaro.rosa@gmail.com  
Material didático e código-fonte desenvolvidos para fins acadêmicos e de pesquisa em Aprendizado por Reforço.

